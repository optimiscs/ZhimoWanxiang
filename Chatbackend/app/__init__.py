from flask import Flask
from flask_login import LoginManager, current_user
from flask_cors import CORS
from .models import User
from .extensions import db
import os
import datetime
import time  # Import time for sleep
from pymongo.errors import ConnectionFailure # Import specific error
import logging # Import logging

def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')
    
    # 启用调试模式
    app.debug = True
    app.config['DEBUG'] = True
    
    # 配置日志级别
    app.logger.setLevel(logging.DEBUG)
    
    # --- 调试日志：打印实际使用的 SECRET_KEY --- 
    # 确保在配置加载之后打印
    # 注意: 不要在生产环境中打印敏感密钥！这仅用于调试。
    try:
        # 使用 get 方法避免 KeyError，尽管 app.secret_key 应该存在
        secret_key_to_log = app.config.get('SECRET_KEY', 'SECRET_KEY not set in config!')
        app.logger.info(f"[DEBUG] Flask app configured. Using SECRET_KEY: {secret_key_to_log}") 
    except Exception as e:
        app.logger.error(f"[DEBUG] Error accessing SECRET_KEY for logging: {e}")
    # ------------------------------------------

    app.logger.info(f"[DEBUG] Flask app configured. Using SECRET_KEY: {app.config.get('SECRET_KEY', 'SECRET_KEY not set in config!')}") 
    
    # Initialize extensions
    CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5001", "http://127.0.0.1:5001"])
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    # Initialize database
    db.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        app.logger.info(f"[DEBUG] user_loader called with user_id: {user_id}") 
        try:
            user = User.get(user_id)
            app.logger.info(f"[DEBUG] user_loader: User.get result for ID {user_id}: {user}") 
            if user:
                 app.logger.info(f"[DEBUG] user_loader: Found user details - Username: {getattr(user, 'username', 'N/A')}, Email: {getattr(user, 'email', 'N/A')}")
            return user
        except Exception as e:
            app.logger.error(f"[DEBUG] user_loader: Error during User.get for ID {user_id}: {e}", exc_info=True) # Log traceback
            return None

    # Register blueprints
    from .routes import api_bp as routes_blueprint
    app.register_blueprint(routes_blueprint, url_prefix='/api')
    
    # Create MongoDB indexes with retry logic
    with app.app_context():
        from .utils.db_utils import ensure_indexes
        retries = 5
        delay = 3 # seconds
        for i in range(retries):
            try:
                app.logger.info(f"Attempting to ensure MongoDB indexes (Attempt {i+1}/{retries})...")
                db.cx.admin.command('ping') 
                if ensure_indexes():
                    app.logger.info("MongoDB indexes ensured successfully.")
                    break 
                else:
                    app.logger.warning("ensure_indexes function reported failure, retrying...")
            except ConnectionFailure as e:
                app.logger.warning(f"MongoDB connection failed during index creation attempt {i+1}: {e}. Retrying in {delay}s...")
            except Exception as e:
                app.logger.error(f"Error during ensure_indexes attempt {i+1}: {e}. Retrying in {delay}s...")
                
            if i < retries - 1:
                time.sleep(delay)
            else:
                app.logger.error("Failed to ensure MongoDB indexes after multiple retries.")
    
    # Log startup information
    # app.logger.info(f"Flask application created (PID: {os.getpid()}, Debug mode: {app.debug})")
    
    return app 