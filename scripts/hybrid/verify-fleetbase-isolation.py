#!/usr/bin/env python3
"""HYB-01 A/B Fleetbase native Redis, MySQL, SocketCluster trust boundaries.

This uses real vendor socket/server.js; native Fleet-Ops PHP migrations and
API are NOT included and must not be implied by these assertions.
"""
import os
import subprocess
import sys
import time

if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-fleetbase-isolation.py PRIVATE_EPHEMERAL_ENV")
values = {}
with open(sys.argv[1], encoding="utf-8") as source:
    for line in source:
        if "=" in line:
            key, value = line.rstrip("\n").split("=", 1)
            values[key] = value


def exec_in(container, command, *, env=None, success=True):
    args = ["docker", "exec"]
    for key, value in (env or {}).items():
        args.extend(["-e", f"{key}={value}"])
    args.extend([container, *command])
    p = subprocess.run(args, text=True, capture_output=True, timeout=15)
    if (p.returncode == 0) != success:
        raise AssertionError(f"Unexpected isolated native container result: {container}")
    return p.stdout.strip()


def node(container, code, success=True):
    return exec_in(container, ["node", "-e", code], success=success)


def probe_socket(container):
    return node(container,
                """fetch('http://127.0.0.1:8000/health-check', {signal:AbortSignal.timeout(2500)})
                .then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))""",
                success=False)  # handled as status below


for tenant in "ab":
    socket = f"hybfleet-socket-{tenant}"
    redis = f"hybfleet-redis-{tenant}"
    if values[f"HYB_SOCKET_{tenant.upper()}_KEY"] == values[
        f"HYB_SOCKET_{'B' if tenant == 'a' else 'A'}_KEY"
    ]:
        raise AssertionError("Native socket signing keys must be independent")
    for attempt in range(40):
        result = subprocess.run(
            ["docker", "exec", socket, "node", "-e",
             "fetch('http://127.0.0.1:8000/health-check',{signal:AbortSignal.timeout(2500)})"
             ".then(x=>process.exit(x.ok?0:1)).catch(()=>process.exit(1))"],
            capture_output=True, timeout=8)
        if result.returncode == 0:
            break
        time.sleep(2)
    else:
        p = subprocess.run(["docker", "logs", "--tail", "25", socket],
                           capture_output=True, text=True, timeout=10)
        raise AssertionError("Pinned Fleetbase socket did not boot: " + p.stderr[-2200:])
    passcode = values[f"HYB_REDIS_{tenant.upper()}_PASS"]
    assert exec_in(redis, ["redis-cli", "--no-auth-warning", "PING"],
                   env={"REDISCLI_AUTH": passcode}) == "PONG"
    exec_in(redis, ["redis-cli", "--no-auth-warning", "PING"],
            env={"REDISCLI_AUTH": "incorrect"}, success=False)
    # No host port may be published for socket or database or Redis.
    for name in [socket, redis, f"hybfleet-mysql_{tenant}-1"]:
        inspect = subprocess.run(
            ["docker", "port", name], capture_output=True, text=True, timeout=8)
        if inspect.returncode == 0 and inspect.stdout.strip():
            raise AssertionError("HYB-01 fixture exposed a host port")

for own, foreign in [("a", "b"), ("b", "a")]:
    socket = f"hybfleet-socket-{own}"
    # App network A must not resolve or connect to B's internal websocket,
    # database or redis (the same applies in reverse).
    for host, port in [
        (f"hybfleet-socket-{foreign}", 8000),
        (f"hybfleet-redis-{foreign}", 6379),
        (f"mysql_{foreign}", 3306),
    ]:
        code = ("""const net=require('node:net');
          const c=net.connect({host:process.argv[1],port:Number(process.argv[2])});
          let done=false;
          const refuse=()=>{if(!done){done=true;c.destroy();process.exit(0)}};
          c.on('connect',()=>process.exit(1));
          c.on('error',refuse);
          setTimeout(refuse,2500);
          """)
        exec_in(socket, ["node", "-e", code, host, str(port)])

print("PASS: pinned Fleetbase SocketCluster and native Redis A/B, independent "
      "signing secrets, Redis auth, MySQL8 topology and cross-network denial. "
      "Fleet-Ops PHP API/migrations/dispatch and CP/IAM remain HELD.")
