import logging
from smartflow.config.settings import settings

def get_logger(name):
    logging.basicConfig(level=settings.LOG_LEVEL)
    return logging.getLogger(name)
