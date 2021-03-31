import logging
import os
from pathlib import Path
import re

import pytest

from goth.assertions import EventStream
from goth.configuration import load_yaml
from goth.runner.log import configure_logging
from goth.runner import Runner
from goth.runner.probe import RequestorProbe


@pytest.mark.asyncio
async def test_run_blender(
    log_dir: Path,
    project_dir: Path,
) -> None:

    # This is the default configuration with 2 wasm/VM providers
    goth_config = load_yaml(Path(__file__).parent / "assets" / "goth-config.yml")

    blender_path = project_dir / "examples" / "blender" / "blender.js"

    configure_logging(log_dir)

    runner = Runner(
        base_log_dir=log_dir,
        compose_config=goth_config.compose_config,
    )

    async with runner(goth_config.containers):

        requestor = runner.get_probes(probe_type=RequestorProbe)[0]

        logger.error("test %s", blender_path)

        async with requestor.run_command_on_host(
            f"node {blender_path} --subnet-tag goth",
            env=os.environ,
        ) as (_cmd_task, cmd_monitor):

            # Add assertions to the command output monitor `cmd_monitor`:
            cmd_monitor.add_assertion(assert_no_errors)
