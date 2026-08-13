import os
import re
import shutil
import logging
import asyncio
import aiofiles
import aiofiles.os
from typing import Optional

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = CURRENT_DIR
BACKEND_DIR = os.path.dirname(APP_DIR)
REPOSOL_DIR = os.path.dirname(BACKEND_DIR)
DEFAULT_DATA_DIR = os.path.abspath(os.environ.get("REPOSOL_DATA_DIR", os.path.join(REPOSOL_DIR, "data")))
DATA_DIR = DEFAULT_DATA_DIR
TEMPLATES_DIR = os.path.abspath(os.path.join(DATA_DIR, "workspaces", "default"))
PROTECTED_WORKSPACE_IDS = frozenset({"default", "master", "templates"})


def get_data_dir() -> str:
    """Returns the current active data directory, respecting pytest monkeypatches on app.storage.DATA_DIR."""
    try:
        import app.storage as storage_module
        if hasattr(storage_module, "DATA_DIR") and storage_module.DATA_DIR and storage_module.DATA_DIR != DEFAULT_DATA_DIR:
            return os.path.abspath(storage_module.DATA_DIR)
    except Exception:
        pass
    if DATA_DIR != DEFAULT_DATA_DIR:
        return os.path.abspath(DATA_DIR)
    return os.path.abspath(os.environ.get("REPOSOL_DATA_DIR", DEFAULT_DATA_DIR))


def is_safe_subdir(parent_dir: str, child_path: str, or_equal: bool = False) -> bool:
    """Verifies that child_path is strictly contained within parent_dir, properly resolving symbolic links."""
    try:
        parent_real = os.path.realpath(parent_dir)
        child_real = os.path.realpath(child_path)
        common = os.path.commonpath([parent_real, child_real])
        if or_equal:
            return common == parent_real
        return common == parent_real and child_real != parent_real
    except ValueError:
        return False


async def sync_master_templates() -> None:
    """Synchronizes pre-baked master templates into DATA_DIR/workspaces/default on persistent volumes."""
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return

    data_dir = get_data_dir()
    templates_dir = os.path.abspath(os.path.join(data_dir, "workspaces", "default"))
    seed_dir = os.environ.get("REPOSOL_TEMPLATES_SEED_DIR")

    if not seed_dir:
        candidate_docker = "/app/templates_seed"
        candidate_local = os.path.join(REPOSOL_DIR, "data", "workspaces", "default")
        if await aiofiles.os.path.exists(candidate_docker) and os.path.isdir(candidate_docker):
            seed_dir = candidate_docker
        elif await aiofiles.os.path.exists(candidate_local) and os.path.isdir(candidate_local):
            seed_dir = candidate_local

    if seed_dir and await aiofiles.os.path.exists(seed_dir) and os.path.isdir(seed_dir):
        if os.path.realpath(seed_dir) == os.path.realpath(templates_dir):
            return
        await aiofiles.os.makedirs(templates_dir, exist_ok=True)
        for root, dirs, files in os.walk(seed_dir):
            rel_path = os.path.relpath(root, seed_dir)
            target_dir = os.path.abspath(os.path.join(templates_dir, rel_path))
            await aiofiles.os.makedirs(target_dir, exist_ok=True)
            for file in files:
                if file.endswith(".json"):
                    src_file = os.path.join(root, file)
                    dst_file = os.path.join(target_dir, file)
                    if not await aiofiles.os.path.exists(dst_file) or os.path.getmtime(src_file) > os.path.getmtime(dst_file):
                        await asyncio.to_thread(shutil.copy2, src_file, dst_file)


async def _seed_stage_templates(stage_dir: str, stage: str) -> None:
    """Seed sample master templates into a workspace stage directory if empty."""
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return
    data_dir = get_data_dir()
    templates_dir = os.path.abspath(os.path.join(data_dir, "workspaces", "default"))
    template_stage_dir = os.path.join(templates_dir, stage)
    if await aiofiles.os.path.exists(template_stage_dir) and os.path.isdir(template_stage_dir):
        if os.path.realpath(stage_dir) == os.path.realpath(template_stage_dir):
            return
        stage_dir_list = await aiofiles.os.listdir(stage_dir)
        existing_json = [f for f in stage_dir_list if f.endswith(".json")]
        if not existing_json:
            template_stage_dir_list = await aiofiles.os.listdir(template_stage_dir)
            for item in template_stage_dir_list:
                if item.endswith(".json"):
                    src = os.path.join(template_stage_dir, item)
                    dst = os.path.join(stage_dir, item)
                    if os.path.isfile(src) and not await aiofiles.os.path.exists(dst):
                        try:
                            await asyncio.to_thread(shutil.copy2, src, dst)
                        except Exception:
                            pass


async def get_stage_dir(stage: str, workspace_id: Optional[str] = None) -> str:
    """Gets and creates the directory for a stage safely, seeding templates if needed."""
    if ".." in stage or (workspace_id and ".." in workspace_id):
        raise ValueError("Directory traversal attempt detected via stage path.")

    safe_ws_id = re.sub(r'[^a-zA-Z0-9_-]', '', workspace_id) if workspace_id else None
    data_dir = get_data_dir()

    if not safe_ws_id or safe_ws_id in ("master", "templates", "default"):
        stage_dir = os.path.abspath(os.path.join(data_dir, "workspaces", "default", stage))
        await aiofiles.os.makedirs(stage_dir, exist_ok=True)
        return stage_dir

    stage_dir = os.path.abspath(os.path.join(data_dir, "workspaces", safe_ws_id, stage))
    is_new = not await aiofiles.os.path.exists(stage_dir)
    await aiofiles.os.makedirs(stage_dir, exist_ok=True)
    if is_new:
        await _seed_stage_templates(stage_dir, stage)
    else:
        stage_dir_list = await aiofiles.os.listdir(stage_dir)
        if not [f for f in stage_dir_list if f.endswith(".json")]:
            await _seed_stage_templates(stage_dir, stage)
    return stage_dir


async def delete_workspace(workspace_id: str) -> None:
    """Deletes an entire workspace directory tree."""
    if not workspace_id:
        raise ValueError("workspace_id must not be empty.")
    if ".." in workspace_id:
        raise ValueError("Directory traversal attempt detected via workspace ID.")

    safe_ws_id = re.sub(r'[^a-zA-Z0-9_-]', '', workspace_id)
    if not safe_ws_id:
        raise ValueError("workspace_id contains no valid characters after sanitization.")
    if safe_ws_id in PROTECTED_WORKSPACE_IDS:
        raise ValueError(f"Cannot delete protected workspace '{safe_ws_id}'.")

    data_dir = get_data_dir()
    workspaces_root = os.path.abspath(os.path.join(data_dir, "workspaces"))
    ws_dir = os.path.abspath(os.path.join(workspaces_root, safe_ws_id))

    if not ws_dir.startswith(workspaces_root + os.sep):
        raise ValueError("Directory traversal attempt detected via workspace ID.")

    if not os.path.isdir(ws_dir):
        raise FileNotFoundError(f"Workspace '{safe_ws_id}' does not exist.")

    def _safe_rmtree(path: str) -> None:
        import stat
        def _on_error(func, p, exc_info):
            try:
                os.chmod(p, stat.S_IWRITE)
                func(p)
            except Exception:
                pass
        try:
            shutil.rmtree(path, onerror=_on_error)
        except Exception as err:
            logger.warning("Gracefully handled error during workspace cleanup of %s: %s", path, err)
            shutil.rmtree(path, ignore_errors=True)

    await asyncio.to_thread(_safe_rmtree, ws_dir)
    logger.info("Deleted workspace directory: %s", ws_dir)
