import logging
from app.config.settings import settings

def get_logger(name):
    logging.basicConfig(level=settings.LOG_LEVEL)
    return logging.getLogger(name)

logger = get_logger(__name__)
