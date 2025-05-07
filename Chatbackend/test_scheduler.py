from app import create_app
from app.scheduled_tasks import register_task, initialize_scheduler, stop_scheduler, get_scheduled_tasks, ScheduledTask
import time
import datetime
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('scheduler_test')

def test_task():
    """A simple test task function for the scheduler"""
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f"Test task executed at {current_time}")
    return True

# Create the app instance
app = create_app()

# Test the ScheduledTask class directly
with app.app_context():
    logger.info("Testing ScheduledTask class directly...")
    
    # Create a task
    task = ScheduledTask("test_direct", test_task, 5, 1)
    
    # Schedule next run
    task._schedule_next_run()
    logger.info(f"Task next run: {task.next_run}")
    
    # Test the should_run method
    should_run = task.should_run()
    logger.info(f"Should run now: {should_run}")
    
    # Test the run method
    logger.info("Executing task directly...")
    result = task.run()
    logger.info(f"Task execution result: {result}")
    
    # Test update_last_run
    task.update_last_run()
    logger.info(f"Task last run updated to: {task.last_run}")
    logger.info(f"Task next run updated to: {task.next_run}")
    
    # Wait 6 seconds to test should_run again
    logger.info("Waiting 6 seconds...")
    time.sleep(6)
    
    # Check should_run again
    should_run = task.should_run()
    logger.info(f"Should run after 6 seconds: {should_run}")
    
    logger.info("ScheduledTask test completed.")
    
logger.info("Test completed.") 