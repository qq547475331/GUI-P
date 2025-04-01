/**
 * 事件总线服务
 * 用于组件间通信，避免组件嵌套带来的props传递问题
 */

class EventBus {
  constructor() {
    this.events = {};
  }

  // 订阅事件
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
    
    // 返回取消订阅的函数
    return () => {
      this.off(eventName, callback);
    };
  }

  // 取消订阅
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    
    if (callback) {
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    } else {
      delete this.events[eventName];
    }
  }

  // 触发事件
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    
    this.events[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件处理器错误 (${eventName}):`, error);
      }
    });
  }

  // publish方法作为emit的别名，用于兼容组件库使用
  publish(eventName, data) {
    this.emit(eventName, data);
  }

  // 订阅方法的别名，用于兼容组件库使用
  subscribe(eventName, callback) {
    return this.on(eventName, callback);
  }
}

// 创建全局事件总线实例
const eventBus = new EventBus();

// 预定义事件名称常量
export const EVENT_TYPES = {
  // 应用相关事件
  APP_CREATED: 'application_created',
  APP_UPDATED: 'application_updated',
  APP_DELETED: 'application_deleted',
  REFRESH_APPS: 'refresh_applications',
  
  // 兼容新格式的事件名
  APPLICATION_CREATED: 'application_created',
  APPLICATION_UPDATED: 'application_updated',
  APPLICATION_DELETED: 'application_deleted',
  REFRESH_APPLICATION_LIST: 'refresh_applications'
};

export default eventBus; 