from fastapi import APIRouter
from .crud import router as crud_router
from .preview import router as preview_router
from .refine_sandbox import router as refine_sandbox_router
from .prepare import router as prepare_router
from .header_config import router as header_config_router
from .upload import router as upload_router

router = APIRouter(prefix="/datasets", tags=["Datasets"])

router.include_router(preview_router)
router.include_router(refine_sandbox_router)
router.include_router(prepare_router)
router.include_router(upload_router)
router.include_router(header_config_router)
router.include_router(crud_router)