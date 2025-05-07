from flask import Blueprint

# 创建父级Blueprint
api_blueprint = Blueprint('api', __name__, url_prefix='/api/v1')

# 导入并注册子级Blueprint
from .chat import chat_api
from .report import report_api

api_blueprint.register_blueprint(chat_api, url_prefix='/chat')
api_blueprint.register_blueprint(report_api, url_prefix='/reports')

# Blueprint注册函数
def register_blueprints(app):
    app.register_blueprint(api_blueprint) 