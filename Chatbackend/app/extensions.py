from flask import Flask
from flask import current_app
import pymongo
from pymongo import MongoClient
import os
from flask_login import LoginManager
import logging

# 创建LoginManager实例
login_manager = LoginManager()

# Database object that will be used across the application
class Database:
    def __init__(self):
        self.client = None
        self.db = None
        self._collections = {}
    
    def init_app(self, app):
        try:
            # 优先使用环境变量中的MongoDB URI
            mongodb_uri = os.environ.get('MONGO_URI')
            
            # 如果环境变量不存在，尝试使用配置文件中的URI
            if not mongodb_uri:
                mongodb_uri = app.config.get('MONGODB_URI')
            
            # 如果配置也不存在，尝试使用默认URI
            if not mongodb_uri:
                # 本地环境默认连接
                mongodb_uri = 'mongodb://localhost:27017/'
            
            # Extract database name from URI or use a default
            try:
                db_name = pymongo.uri_parser.parse_uri(mongodb_uri)['database']
                if not db_name:
                    db_name = os.environ.get('DB_NAME') or app.config.get('DB_NAME') or 'zhimo'
            except Exception:
                db_name = os.environ.get('DB_NAME') or app.config.get('DB_NAME') or 'zhimo'
            
            app.logger.info(f"正在连接MongoDB: {mongodb_uri}, 数据库: {db_name}")
        
            # 创建MongoDB客户端，设置较短的超时时间
            self.client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
            self.db = self.client[db_name]
            
            # 测试连接
            self.db.command('ping')
            app.logger.info(f"MongoDB connection initialized to database '{db_name}'")
        except Exception as e:
            app.logger.error(f"MongoDB connection error: {str(e)}")
            app.logger.warning("Using fallback in-memory storage - data will not persist!")
            # 仅在开发模式下使用空字典作为后备存储
            if app.config.get('DEBUG', False):
                self.db = {}
            else:
                raise
    
    def __getattr__(self, name):
        """Allow access to MongoDB collections as attributes dynamically."""
        # Check if client and db are initialized
        if self.db is None:
            raise RuntimeError("Database not initialized. Call init_app first.")
        
        # Return the collection object
        # No need to cache in self._collections if accessed dynamically
        return self.db[name]
    
    @property
    def cx(self):
        """Provide access to the underlying MongoClient."""
        if self.client is None:
             raise RuntimeError("Database not initialized. Call init_app first.")
        return self.client

# 创建单例数据库实例
db = Database()

def init_extensions(app):
    """初始化应用扩展"""
    # 配置Flask-Login
    login_manager.init_app(app)
    login_manager.login_view = "api.login"
    login_manager.login_message = "请先登录"
    
    # 初始化MongoDB连接
    db.init_app(app)

# REMOVE the redundant MongoDB class
# class MongoDB:
#     def __init__(self, app=None):
#         ...
#     
#     def init_app(self, app):
#         ...
#         # REMOVE INDEX CREATION FROM HERE
#         try:
#             ...
#         except Exception as e:
#             ...

# MongoDB配置
# db = None

# def init_extensions(app):
#     """初始化应用扩展"""
#     # 配置Flask-Login
#     login_manager.init_app(app)
#     login_manager.login_view = "api.login"
#     login_manager.login_message = "请先登录"
#     
#     # 初始化MongoDB连接
#     global db
#     try:
#         # 优先使用环境变量中的MongoDB URI
#         mongo_uri = os.environ.get('MONGO_URI')
#         
#         # 如果环境变量不存在，尝试使用配置文件中的URI
#         if not mongo_uri:
#             mongo_uri = app.config.get('MONGO_URI')
#         
#         # 如果配置也不存在，尝试使用默认URI
#         if not mongo_uri:
#             # 检查是否在Docker环境中（尝试连接Docker网络中的db服务）
#             mongo_uri = "mongodb://localhost:27017/"
#             
#         db_name = os.environ.get('DB_NAME') or app.config.get('DB_NAME') or 'zhimo'
#         
#         app.logger.info(f"正在连接MongoDB: {mongo_uri}, 数据库: {db_name}")
#         
#         # 创建MongoDB客户端
#         client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
#         db = client[db_name]
#         
#         # 测试连接
#         db.command('ping')
#         app.logger.info(f"MongoDB connection initialized to database '{db_name}'")
#         
#     except Exception as e:
#         app.logger.error(f"MongoDB connection error: {str(e)}")
#         app.logger.warning("Using fallback in-memory storage - data will not persist!")
#         db = {}  # 使用字典作为后备存储

# db = Database() 