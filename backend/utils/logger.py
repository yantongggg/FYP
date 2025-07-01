import logging
import os
from datetime import datetime

def setup_logger(name, level=logging.INFO):
    """
    Set up a logger with consistent formatting
    """
    # Create logs directory if it doesn't exist
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid adding multiple handlers
    if logger.handlers:
        return logger
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    simple_formatter = logging.Formatter(
        '%(levelname)s - %(message)s'
    )
    
    # File handler for detailed logs
    file_handler = logging.FileHandler(
        os.path.join(log_dir, f'biometric_auth_{datetime.now().strftime("%Y%m%d")}.log')
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    
    # Console handler for important messages
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    
    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# Security event logger
def log_security_event(event_type, user_id=None, details=None, severity='INFO'):
    """
    Log security-related events
    """
    security_logger = setup_logger('security')
    
    message = f"SECURITY_EVENT: {event_type}"
    if user_id:
        message += f" | USER: {user_id}"
    if details:
        message += f" | DETAILS: {details}"
    
    if severity == 'CRITICAL':
        security_logger.critical(message)
    elif severity == 'ERROR':
        security_logger.error(message)
    elif severity == 'WARNING':
        security_logger.warning(message)
    else:
        security_logger.info(message)

# Performance logger
def log_performance(operation, duration, user_id=None, additional_info=None):
    """
    Log performance metrics
    """
    perf_logger = setup_logger('performance')
    
    message = f"PERFORMANCE: {operation} took {duration:.3f}s"
    if user_id:
        message += f" | USER: {user_id}"
    if additional_info:
        message += f" | INFO: {additional_info}"
    
    perf_logger.info(message)

# Audit logger
def log_audit_event(action, user_id=None, resource=None, result='SUCCESS', details=None):
    """
    Log audit events for compliance
    """
    audit_logger = setup_logger('audit')
    
    message = f"AUDIT: {action} | RESULT: {result}"
    if user_id:
        message += f" | USER: {user_id}"
    if resource:
        message += f" | RESOURCE: {resource}"
    if details:
        message += f" | DETAILS: {details}"
    
    audit_logger.info(message)