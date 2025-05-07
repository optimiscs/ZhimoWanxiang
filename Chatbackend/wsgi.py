from app import create_app
import logging

# 配置logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logger.debug("Starting application in debug mode")

# 创建应用实例，开启调试模式
app = create_app()

# 显式启用调试模式
app.debug = True
app.config['DEBUG'] = True
 
if __name__ == "__main__":
    # This part is mainly for direct execution (if needed), 
    # Gunicorn uses the 'app' variable directly.
    # You might want to configure host/port from env vars here too.
    app.run(host='0.0.0.0', port=5000, debug=True) 