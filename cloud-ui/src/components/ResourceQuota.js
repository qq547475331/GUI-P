import React, { useState, useEffect } from 'react';
import { Progress, Spin } from 'antd';
import apiService from '../services/api';
import './ResourceQuota.css';

const ResourceQuota = ({ formData }) => {
  const [quotaData, setQuotaData] = useState({
    cpu: 0,
    memory: 0,
    storage: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);

  // 获取资源配额
  useEffect(() => {
    const fetchResourceQuota = async () => {
      try {
        const data = await apiService.getResourceQuota();
        console.log('Resource quota:', data);
      } catch (error) {
        console.error('获取资源配额失败:', error);
      }
    };

    fetchResourceQuota();
  }, []);

  // 监听表单数据变化，重新计算资源使用情况
  useEffect(() => {
    const calculateResourceUsage = async () => {
      if (!formData) return;
      
      try {
        setLoading(true);
        
        // 提取资源相关数据
        const resources = {
          cpu: formData.cpu || 0.2,
          memory: formData.memory || 256,
          instances: formData.instances || 1,
          volumes: formData.volumes || []
        };
        
        // 使用本地计算的备选方案
        const cpuUsage = resources.cpu * resources.instances;
        const memoryUsage = resources.memory * resources.instances / 1024; // 转为GB
        const storageUsage = resources.volumes.reduce((total, vol) => total + (vol.size || 0), 0);
        
        setQuotaData({
          cpu: cpuUsage,
          cpuPercent: Math.min(cpuUsage / 1 * 100, 100), // 假设最大配额为1核
          memory: memoryUsage,
          memoryPercent: Math.min(memoryUsage / 1 * 100, 100), // 假设最大配额为1GB
          storage: storageUsage,
          storagePercent: Math.min(storageUsage / 10 * 100, 100), // 假设最大配额为10GB
          total: cpuUsage * 0.5 + memoryUsage * 0.3 + storageUsage * 0.05 // 简单计算资源使用比例
        });
      } catch (error) {
        console.error('计算资源使用出错:', error);
      } finally {
        setLoading(false);
      }
    };
    
    calculateResourceUsage();
  }, [formData]);

  return (
    <div className="resource-quota">
      <h3>资源配额</h3>
      
      {loading ? (
        <div className="loading-container">
          <Spin />
        </div>
      ) : (
        <>
          <div className="quota-item">
            <div className="quota-label">CPU</div>
            <div className="quota-progress">
              <Progress 
                percent={quotaData.cpuPercent || 13} 
                strokeColor="#1890ff" 
                showInfo={false} 
                size="small" 
              />
            </div>
            <div className="quota-value">{quotaData.cpu?.toFixed(2) || '0.13'}</div>
          </div>
          
          <div className="quota-item">
            <div className="quota-label">内存</div>
            <div className="quota-progress">
              <Progress 
                percent={quotaData.memoryPercent || 8} 
                strokeColor="#52c41a" 
                showInfo={false} 
                size="small" 
              />
            </div>
            <div className="quota-value">{quotaData.memory?.toFixed(2) || '0.08'}</div>
          </div>
          
          <div className="quota-item">
            <div className="quota-label">存储卷</div>
            <div className="quota-progress">
              <Progress 
                percent={quotaData.storagePercent || 0} 
                strokeColor="#722ed1" 
                showInfo={false} 
                size="small" 
              />
            </div>
            <div className="quota-value">{quotaData.storage?.toFixed(2) || '0.00'}</div>
          </div>
          
          <div className="quota-item">
            <div className="quota-label">资源占用比</div>
            <div className="quota-total">{quotaData.total?.toFixed(2) || '0.21'}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default ResourceQuota; 