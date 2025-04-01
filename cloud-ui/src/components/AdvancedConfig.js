import React, { useState, useEffect } from 'react';
import { Form, Input, Radio, Button, Tooltip, Modal, Select, Tabs, InputNumber, Collapse, Switch, Card, Alert, Checkbox, message, Row, Col, Typography } from 'antd';
import { PlusOutlined, EditOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import './AdvancedConfig.css';

const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Option } = Select;
const { Title } = Typography;

const AdvancedConfig = ({ formData, setFormData, form, onValuesChange }) => {
  const [envModalVisible, setEnvModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [addVolumeMountModalVisible, setAddVolumeMountModalVisible] = useState(false);
  const [securityContextModalVisible, setSecurityContextModalVisible] = useState(false);
  const [schedulingRulesModalVisible, setSchedulingRulesModalVisible] = useState(false);

  // 更新健康检查处理函数
  const handleHealthCheckChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      enableHealthCheck: checked
    }));
    // 如果禁用了健康检查，同时禁用所有探针
    if (!checked) {
      form.setFieldsValue({
        enableLivenessProbe: false,
        enableReadinessProbe: false,
        enableStartupProbe: false
      });
      setFormData(prev => ({
        ...prev,
        enableLivenessProbe: false,
        enableReadinessProbe: false,
        enableStartupProbe: false
      }));
    }
    if (onValuesChange) {
      onValuesChange(form);
    }
  };

  // 更新存活探针处理函数
  const handleLivenessProbeChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      enableLivenessProbe: checked
    }));
    if (onValuesChange) {
      onValuesChange(form);
    }
  };

  // 更新就绪探针处理函数
  const handleReadinessProbeChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      enableReadinessProbe: checked
    }));
    if (onValuesChange) {
      onValuesChange(form);
    }
  };

  // 添加启动探针处理函数
  const handleStartupProbeChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      enableStartupProbe: checked
    }));
    if (onValuesChange) {
      onValuesChange(form);
    }
  };

  // 更新生命周期处理函数
  const handleLifecycleChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      enableLifecycle: checked
    }));
    // 如果禁用了生命周期管理，同时禁用所有生命周期钩子
    if (!checked) {
      form.setFieldsValue({
        enablePostStart: false,
        enablePreStop: false
      });
      setFormData(prev => ({
        ...prev,
        enablePostStart: false,
        enablePreStop: false
      }));
    }
    if (onValuesChange) {
      onValuesChange(form);
    }
  };

  // 添加启动后钩子处理函数
  const handlePostStartChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      enablePostStart: checked
    }));
    if (onValuesChange) {
      onValuesChange(form);
    }
  };

  // 添加终止前钩子处理函数
  const handlePreStopChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      enablePreStop: checked
    }));
    if (onValuesChange) {
      onValuesChange(form);
    }
  };

  // 表单数据变更处理
  const handleFormChange = (changedValues, allValues) => {
    // 健康检查启用状态处理
    if ('enableHealthCheck' in changedValues) {
      if (!changedValues.enableHealthCheck) {
        // 健康检查禁用，清除所有相关配置
        form.setFieldsValue({
          enableLivenessProbe: false,
          enableReadinessProbe: false,
          enableStartupProbe: false,
          livenessProbe: undefined,
          readinessProbe: undefined,
          startupProbe: undefined
        });
      }
    }

    // 生命周期管理启用状态处理
    if ('enableLifecycle' in changedValues) {
      if (!changedValues.enableLifecycle) {
        // 生命周期管理禁用，清除所有相关配置
        form.setFieldsValue({
          enablePostStart: false,
          enablePreStop: false,
          lifecycle: undefined
        });
      }
    }

    // 验证启动探针完整性
    if (allValues.enableStartupProbe) {
      const startupProbe = allValues.startupProbe || {};
      let isValid = false;
      
      if (startupProbe.probeType === 'http' && startupProbe.path && startupProbe.port) {
        isValid = true;
      } else if (startupProbe.probeType === 'tcp' && startupProbe.port) {
        isValid = true;
      } else if (startupProbe.probeType === 'command' && startupProbe.command) {
        isValid = true;
      }
      
      if (!isValid) {
        // 如果配置不完整，可以选择禁用或提示用户
        console.log('启动探针配置不完整');
      }
    }

    // 验证生命周期钩子完整性
    if (allValues.enableLifecycle) {
      // 检查PostStart钩子完整性
      if (allValues.enablePostStart) {
        const postStart = allValues.lifecycle?.postStart || {};
        let isValid = false;
        
        if (postStart.type === 'exec' && postStart.command) {
          isValid = true;
        } else if (postStart.type === 'httpGet' && postStart.path && postStart.port) {
          isValid = true;
        } else if (postStart.type === 'tcpSocket' && postStart.port) {
          isValid = true;
        }
        
        if (!isValid) {
          console.log('PostStart钩子配置不完整');
        }
      }
      
      // 检查PreStop钩子完整性
      if (allValues.enablePreStop) {
        const preStop = allValues.lifecycle?.preStop || {};
        let isValid = false;
        
        if (preStop.type === 'exec' && preStop.command) {
          isValid = true;
        } else if (preStop.type === 'httpGet' && preStop.path && preStop.port) {
          isValid = true;
        } else if (preStop.type === 'tcpSocket' && preStop.port) {
          isValid = true;
        }
        
        if (!isValid) {
          console.log('PreStop钩子配置不完整');
        }
      }
    }

    // 更新formData
    const newData = { ...formData };

    // 处理健康检查
    if (!allValues.enableHealthCheck) {
      newData.livenessProbe = undefined;
      newData.readinessProbe = undefined;
      newData.startupProbe = undefined;
    } else {
      // 处理各种类型的探针
      if (allValues.enableLivenessProbe) {
        newData.livenessProbe = processProbeData(allValues.livenessProbe);
      } else {
        newData.livenessProbe = undefined;
      }
      
      if (allValues.enableReadinessProbe) {
        newData.readinessProbe = processProbeData(allValues.readinessProbe);
      } else {
        newData.readinessProbe = undefined;
      }
      
      if (allValues.enableStartupProbe) {
        const startupProbe = processProbeData(allValues.startupProbe);
        if (isProbeValid(startupProbe, allValues.startupProbe?.probeType)) {
          newData.startupProbe = startupProbe;
        } else {
          newData.startupProbe = undefined;
          form.setFieldsValue({ enableStartupProbe: false });
          message.warning('启动探针配置不完整，已自动禁用');
        }
      } else {
        newData.startupProbe = undefined;
      }
    }

    // 处理生命周期钩子
    if (!allValues.enableLifecycle) {
      newData.lifecycle = undefined;
    } else {
      newData.lifecycle = {};
      
      // 处理PostStart钩子
      if (allValues.enablePostStart) {
        const postStart = processLifecycleHandler(
          allValues.lifecycle?.postStart?.type,
          allValues.lifecycle?.postStart
        );
        
        if (isLifecycleHandlerValid(postStart, allValues.lifecycle?.postStart?.type)) {
          newData.lifecycle.postStart = postStart;
        } else {
          form.setFieldsValue({ enablePostStart: false });
          message.warning('启动后钩子配置不完整，已自动禁用');
        }
      }
      
      // 处理PreStop钩子
      if (allValues.enablePreStop) {
        const preStop = processLifecycleHandler(
          allValues.lifecycle?.preStop?.type,
          allValues.lifecycle?.preStop
        );
        
        if (isLifecycleHandlerValid(preStop, allValues.lifecycle?.preStop?.type)) {
          newData.lifecycle.preStop = preStop;
        } else {
          form.setFieldsValue({ enablePreStop: false });
          message.warning('终止前钩子配置不完整，已自动禁用');
        }
      }
      
      // 如果没有有效的钩子，禁用整个生命周期管理
      if (!newData.lifecycle.postStart && !newData.lifecycle.preStop) {
        newData.lifecycle = undefined;
        form.setFieldsValue({ enableLifecycle: false });
        message.warning('没有有效的生命周期钩子配置，已自动禁用生命周期管理');
      }
    }

    // 更新其他配置项
    // ... existing code ...

    setFormData(newData);
    // 修复onValuesChange未定义的问题，确保安全调用
    if (typeof onValuesChange === 'function') {
      onValuesChange(newData);
    }
  };

  // 检查探针配置是否有效
  const isProbeValid = (probe, probeType) => {
    if (!probe || !probeType) return false;
    
    switch (probeType) {
      case 'http':
        return probe.path && probe.port;
      case 'tcp':
        return probe.port > 0;
      case 'command':
        return probe.command && probe.command.length > 0;
      default:
        return false;
    }
  };

  // 检查生命周期处理器是否有效
  const isLifecycleHandlerValid = (handler, handlerType) => {
    if (!handler || !handlerType) return false;
    
    switch (handlerType) {
      case 'exec':
        return handler.command && handler.command.length > 0;
      case 'httpGet':
        return handler.path && handler.port > 0;
      case 'tcpSocket':
        return handler.port > 0;
      default:
        return false;
    }
  };

  // 处理探针数据，将UI表单数据转换为API需要的格式
  const processProbeData = (probeData) => {
    if (!probeData) return undefined;
    
    const result = { ...probeData };
    
    // 处理命令数组
    if (probeData.probeType === 'command' && probeData.command) {
      // 如果是字符串，转换为数组
      if (typeof probeData.command === 'string') {
        // 先检查是否以半角逗号分隔
        if (probeData.command.includes(',')) {
          result.command = probeData.command
            .split(',')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd);
        } else {
          // 否则按行分割
          result.command = probeData.command
            .split('\n')
            .filter(line => line.trim());
        }
      }
    }
    
    return result;
  };

  // 处理生命周期处理器数据
  const processLifecycleHandler = (type, handlerData) => {
    if (!type || !handlerData) return undefined;
    
    const result = { ...handlerData };
    
    // 处理命令数组
    if (type === 'exec' && handlerData.command) {
      // 如果是字符串，转换为数组
      if (typeof handlerData.command === 'string') {
        // 先检查是否以半角逗号分隔
        if (handlerData.command.includes(',')) {
          result.command = handlerData.command
            .split(',')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd);
        } else {
          // 否则按行分割
          result.command = handlerData.command
            .split('\n')
            .filter(line => line.trim());
        }
      }
    }
    
    return result;
  };

  // 打开环境变量编辑模态框
  const showEnvModal = () => {
    setEnvModalVisible(true);
  };

  // 打开配置文件编辑模态框
  const showConfigModal = () => {
    setConfigModalVisible(true);
  };

  // 打开存储卷编辑模态框
  const showStorageModal = () => {
    setStorageModalVisible(true);
  };

  // 打开安全上下文编辑模态框
  const showSecurityContextModal = () => {
    setSecurityContextModalVisible(true);
  };

  // 打开调度规则编辑模态框
  const showSchedulingRulesModal = () => {
    setSchedulingRulesModalVisible(true);
  };

  // 处理环境变量提交
  const handleEnvSubmit = (values) => {
    setFormData({
      ...formData,
      envVars: values
    });
    setEnvModalVisible(false);
  };

  // 打开卷挂载编辑模态框
  const showAddVolumeMountModal = () => {
    setAddVolumeMountModalVisible(true);
  };

  // 在适当的位置添加健康检查UI渲染函数
  const renderHealthCheckConfig = () => (
    <div className="health-check-container">
      <div className="health-check-header">
        <Title level={5} className="health-check-title">健康检查</Title>
        <Tooltip title="Kubernetes使用健康检查探针监控容器状态，确保服务可用性">
          <InfoCircleOutlined />
        </Tooltip>
        <Form.Item name="enableHealthCheck" valuePropName="checked" style={{ marginBottom: 0, marginLeft: 8 }}>
          <Switch 
            onChange={handleHealthCheckChange}
            checkedChildren="启用" 
            unCheckedChildren="禁用"
          />
        </Form.Item>
      </div>
      
      {formData.enableHealthCheck && (
        <Card className="health-checks-card">
          <Row gutter={[16, 16]}>
            {/* 存活检查 */}
            <Col span={24}>
              <div className="probe-group">
                <div className="probe-header">
                  <Title level={5} className="probe-title">存活检查</Title>
                  <Tooltip title="存活检查失败会导致容器重启">
                    <InfoCircleOutlined />
                  </Tooltip>
                  <Form.Item name="enableLivenessProbe" valuePropName="checked" style={{ marginBottom: 0, marginLeft: 8 }}>
                    <Switch
                      onChange={handleLivenessProbeChange}
                      checkedChildren="启用" 
                      unCheckedChildren="禁用"
                    />
                  </Form.Item>
                </div>
                
                {formData.enableLivenessProbe && (
                  <Form.Item noStyle>
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Form.Item name={['livenessProbe', 'probeType']} label="类型" initialValue="http">
                          <Radio.Group onChange={(e) => {
                            const probeType = e.target.value;
                            // 更新探针类型状态
                            form.setFieldsValue({
                              livenessProbe: {
                                ...form.getFieldValue('livenessProbe'),
                                probeType
                              }
                            });
                            
                            // 清除之前探针类型的配置
                            if (probeType === 'http') {
                              form.setFieldsValue({
                                livenessProbe: {
                                  ...form.getFieldValue('livenessProbe'),
                                  command: undefined
                                }
                              });
                            } else if (probeType === 'command') {
                              form.setFieldsValue({
                                livenessProbe: {
                                  ...form.getFieldValue('livenessProbe'),
                                  path: undefined,
                                }
                              });
                            } else if (probeType === 'tcp') {
                              form.setFieldsValue({
                                livenessProbe: {
                                  ...form.getFieldValue('livenessProbe'),
                                  path: undefined,
                                  command: undefined
                                }
                              });
                            }
                            
                            if (onValuesChange) {
                              onValuesChange(form);
                            }
                          }}>
                            <Radio value="http">HTTP请求</Radio>
                            <Radio value="command">命令</Radio>
                            <Radio value="tcp">TCP端口</Radio>
          </Radio.Group>
        </Form.Item>
                      </Col>
                      
                      {form.getFieldValue(['livenessProbe', 'probeType']) === 'http' && (
                        <>
                          <Col span={12}>
                            <Form.Item 
                              name={['livenessProbe', 'path']} 
                              label="路径" 
                              rules={[{ required: true, message: '请输入检查路径' }]}
                              initialValue="/"
                            >
                              <Input placeholder="/health" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
        <Form.Item 
                              name={['livenessProbe', 'port']} 
                              label="端口" 
                              rules={[{ required: true, message: '请输入检查端口' }]}
                              initialValue={80}
                            >
                              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
                          </Col>
                        </>
                      )}
        
                      {form.getFieldValue(['livenessProbe', 'probeType']) === 'tcp' && (
                        <Col span={12}>
        <Form.Item 
                            name={['livenessProbe', 'port']} 
                            label="端口" 
                            rules={[{ required: true, message: '请输入检查端口' }]}
                            initialValue={80}
                          >
                            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
                        </Col>
                      )}
        
                      {form.getFieldValue(['livenessProbe', 'probeType']) === 'command' && (
                        <Col span={24}>
        <Form.Item 
                            name={['livenessProbe', 'command']} 
                            label="命令" 
                            rules={[{ required: true, message: '请输入检查命令' }]}
                            extra="可以使用半角逗号(,)或换行分隔多条命令，例如: /bin/sh, -c, cat /tmp/healthy 或直接输入完整命令如 ls /app"
                          >
                            <Input.TextArea rows={2} placeholder="/bin/sh, -c, cat /tmp/healthy" />
                          </Form.Item>
                        </Col>
                      )}
                      
                      <Col span={24}>
                        <Collapse ghost>
                          <Panel header="高级参数" key="1">
                            <Row gutter={[16, 0]}>
                              <Col span={8}>
                                <Form.Item 
                                  name={['livenessProbe', 'initialDelaySeconds']} 
                                  label="初始延迟(秒)" 
                                  initialValue={0}
                                >
                                  <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
                              </Col>
                              <Col span={8}>
        <Form.Item 
                                  name={['livenessProbe', 'periodSeconds']} 
                                  label="检查间隔(秒)" 
                                  initialValue={10}
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['livenessProbe', 'failureThreshold']} 
                                  label="失败阈值" 
                                  initialValue={3}
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
                              </Col>
                              <Col span={8}>
        <Form.Item 
                                  name={['livenessProbe', 'timeoutSeconds']} 
                                  label="超时时间(秒)" 
                                  initialValue={1}
                                >
                                  <InputNumber min={0} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['livenessProbe', 'successThreshold']} 
                                  label="成功阈值" 
                                  initialValue={1}
                                  tooltip="存活探针必须为1"
                                >
                                  <InputNumber min={1} max={1} disabled style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                            </Row>
                          </Panel>
                        </Collapse>
                      </Col>
                    </Row>
                  </Form.Item>
                )}
              </div>
            </Col>
            
            {/* 就绪检查 */}
            <Col span={24}>
              <div className="probe-group">
                <div className="probe-header">
                  <Title level={5} className="probe-title">就绪检查</Title>
                  <Tooltip title="就绪检查失败会阻止流量路由到容器">
                    <InfoCircleOutlined />
                  </Tooltip>
                  <Form.Item name="enableReadinessProbe" valuePropName="checked" style={{ marginBottom: 0, marginLeft: 8 }}>
                    <Switch
                      onChange={handleReadinessProbeChange}
                      checkedChildren="启用" 
                      unCheckedChildren="禁用"
                    />
                  </Form.Item>
                </div>
                
                {formData.enableReadinessProbe && (
                  <Form.Item noStyle>
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Form.Item name={['readinessProbe', 'probeType']} label="类型" initialValue="http">
                          <Radio.Group onChange={(e) => {
                            const probeType = e.target.value;
                            // 更新探针类型状态
                            form.setFieldsValue({
                              readinessProbe: {
                                ...form.getFieldValue('readinessProbe'),
                                probeType
                              }
                            });
                            
                            // 清除之前探针类型的配置
                            if (probeType === 'http') {
                              form.setFieldsValue({
                                readinessProbe: {
                                  ...form.getFieldValue('readinessProbe'),
                                  command: undefined
                                }
                              });
                            } else if (probeType === 'command') {
                              form.setFieldsValue({
                                readinessProbe: {
                                  ...form.getFieldValue('readinessProbe'),
                                  path: undefined,
                                }
                              });
                            } else if (probeType === 'tcp') {
                              form.setFieldsValue({
                                readinessProbe: {
                                  ...form.getFieldValue('readinessProbe'),
                                  path: undefined,
                                  command: undefined
                                }
                              });
                            }
                            
                            if (onValuesChange) {
                              onValuesChange(form);
                            }
                          }}>
                            <Radio value="http">HTTP请求</Radio>
                            <Radio value="command">命令</Radio>
                            <Radio value="tcp">TCP端口</Radio>
                          </Radio.Group>
                        </Form.Item>
                      </Col>
                      
                      {form.getFieldValue(['readinessProbe', 'probeType']) === 'http' && (
                        <>
                          <Col span={12}>
                            <Form.Item 
                              name={['readinessProbe', 'path']} 
                              label="路径" 
                              rules={[{ required: true, message: '请输入检查路径' }]}
                              initialValue="/"
                            >
                              <Input placeholder="/ready" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item 
                              name={['readinessProbe', 'port']} 
                              label="端口" 
                              rules={[{ required: true, message: '请输入检查端口' }]}
                              initialValue={80}
                            >
                              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </>
                      )}
                      
                      {form.getFieldValue(['readinessProbe', 'probeType']) === 'tcp' && (
                        <Col span={12}>
                          <Form.Item 
                            name={['readinessProbe', 'port']} 
                            label="端口" 
                            rules={[{ required: true, message: '请输入检查端口' }]}
                            initialValue={80}
                          >
                            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      )}
                      
                      {form.getFieldValue(['readinessProbe', 'probeType']) === 'command' && (
                        <Col span={24}>
                          <Form.Item 
                            name={['readinessProbe', 'command']} 
                            label="命令" 
                            rules={[{ required: true, message: '请输入检查命令' }]}
                            extra="可以使用半角逗号(,)或换行分隔多条命令，例如: /bin/sh, -c, cat /tmp/ready 或直接输入完整命令如 ls /app"
                          >
                            <Input.TextArea rows={2} placeholder="/bin/sh, -c, cat /tmp/ready" />
                          </Form.Item>
                        </Col>
                      )}
                      
                      <Col span={24}>
                        <Collapse ghost>
                          <Panel header="高级参数" key="1">
                            <Row gutter={[16, 0]}>
                              <Col span={8}>
                                <Form.Item 
                                  name={['readinessProbe', 'initialDelaySeconds']} 
                                  label="初始延迟(秒)" 
                                  initialValue={0}
                                >
                                  <InputNumber min={0} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['readinessProbe', 'periodSeconds']} 
                                  label="检查间隔(秒)" 
                                  initialValue={10}
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['readinessProbe', 'failureThreshold']} 
                                  label="失败阈值" 
                                  initialValue={3}
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['readinessProbe', 'timeoutSeconds']} 
                                  label="超时时间(秒)" 
                                  initialValue={1}
                                >
                                  <InputNumber min={0} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['readinessProbe', 'successThreshold']} 
                                  label="成功阈值" 
                                  initialValue={1}
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                            </Row>
                          </Panel>
                        </Collapse>
                      </Col>
                    </Row>
                  </Form.Item>
                )}
              </div>
            </Col>
            
            {/* 启动探针 */}
            <Col span={24}>
              <div className="probe-group">
                <div className="probe-header">
                  <Title level={5} className="probe-title">启动探针</Title>
                  <Tooltip title="启动探针用于检测应用是否完成启动，特别适用于启动慢的应用">
                    <InfoCircleOutlined />
                  </Tooltip>
                  <Form.Item name="enableStartupProbe" valuePropName="checked" style={{ marginBottom: 0, marginLeft: 8 }}>
                    <Switch
                      onChange={handleStartupProbeChange}
                      checkedChildren="启用" 
                      unCheckedChildren="禁用"
                    />
                  </Form.Item>
                </div>
                
                {formData.enableStartupProbe && (
                  <Form.Item noStyle>
                    <Alert
                      message="启动探针说明"
                      description={
                        <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                          <li>启动探针用于检测容器中的应用是否已经启动完成</li>
                          <li>对于启动缓慢的应用程序特别有用，避免因启动时间长而被存活探针错误重启</li>
                          <li>当启动探针成功后，存活探针才会开始工作</li>
                          <li>建议为启动慢的应用设置较大的失败阈值和检查间隔</li>
                        </ul>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: '16px' }}
                    />
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Form.Item name={['startupProbe', 'probeType']} label="类型" initialValue="http">
                          <Radio.Group onChange={(e) => {
                            const probeType = e.target.value;
                            // 更新探针类型状态
                            form.setFieldsValue({
                              startupProbe: {
                                ...form.getFieldValue('startupProbe'),
                                probeType
                              }
                            });
                            
                            // 清除之前探针类型的配置
                            if (probeType === 'http') {
                              form.setFieldsValue({
                                startupProbe: {
                                  ...form.getFieldValue('startupProbe'),
                                  command: undefined
                                }
                              });
                            } else if (probeType === 'command') {
                              form.setFieldsValue({
                                startupProbe: {
                                  ...form.getFieldValue('startupProbe'),
                                  path: undefined,
                                }
                              });
                            } else if (probeType === 'tcp') {
                              form.setFieldsValue({
                                startupProbe: {
                                  ...form.getFieldValue('startupProbe'),
                                  path: undefined,
                                  command: undefined
                                }
                              });
                            }
                            
                            if (onValuesChange) {
                              onValuesChange(form);
                            }
                          }}>
                            <Radio value="http">HTTP请求</Radio>
                            <Radio value="command">命令</Radio>
                            <Radio value="tcp">TCP端口</Radio>
                          </Radio.Group>
                        </Form.Item>
                      </Col>
                      
                      {form.getFieldValue(['startupProbe', 'probeType']) === 'http' && (
                        <>
                          <Col span={12}>
                            <Form.Item 
                              name={['startupProbe', 'path']} 
                              label="路径" 
                              rules={[{ required: true, message: '请输入检查路径' }]}
                              initialValue="/"
                            >
                              <Input placeholder="/startup" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item 
                              name={['startupProbe', 'port']} 
                              label="端口" 
                              rules={[{ required: true, message: '请输入检查端口' }]}
                              initialValue={80}
                            >
                              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                        </>
                      )}
                      
                      {form.getFieldValue(['startupProbe', 'probeType']) === 'tcp' && (
                        <Col span={12}>
                          <Form.Item 
                            name={['startupProbe', 'port']} 
                            label="端口" 
                            rules={[{ required: true, message: '请输入检查端口' }]}
                            initialValue={80}
                          >
                            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      )}
                      
                      {form.getFieldValue(['startupProbe', 'probeType']) === 'command' && (
                        <Col span={24}>
                          <Form.Item 
                            name={['startupProbe', 'command']} 
                            label="命令" 
                            rules={[{ required: true, message: '请输入检查命令' }]}
                            extra="可以使用半角逗号(,)或换行分隔多条命令，例如: /bin/sh, -c, cat /tmp/started 或直接输入完整命令如 ls /app"
                          >
                            <Input.TextArea rows={2} placeholder="/bin/sh, -c, cat /tmp/started" />
                          </Form.Item>
                        </Col>
                      )}
                      
                      <Col span={24}>
                        <Collapse ghost>
                          <Panel header="高级参数" key="1">
                            <Row gutter={[16, 0]}>
                              <Col span={8}>
                                <Form.Item 
                                  name={['startupProbe', 'initialDelaySeconds']} 
                                  label="初始延迟(秒)" 
                                  initialValue={5}
                                  tooltip="容器启动后多久开始探测，对于启动慢的应用建议设置更长"
                                >
                                  <InputNumber min={0} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['startupProbe', 'periodSeconds']} 
                                  label="检查间隔(秒)" 
                                  initialValue={15}
                                  tooltip="执行探测的频率，建议设置较长间隔减轻应用负担"
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['startupProbe', 'failureThreshold']} 
                                  label="失败阈值" 
                                  initialValue={6}
                                  tooltip="连续多少次失败才视为探测失败，启动探针建议使用较大值"
                                >
                                  <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['startupProbe', 'timeoutSeconds']} 
                                  label="超时时间(秒)" 
                                  initialValue={3}
                                  tooltip="探测超时时间，启动探针建议设置较长超时"
                                >
                                  <InputNumber min={0} style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item 
                                  name={['startupProbe', 'successThreshold']} 
                                  label="成功阈值" 
                                  initialValue={1}
                                  tooltip="启动探针必须为1"
                                >
                                  <InputNumber min={1} max={1} disabled style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                            </Row>
                          </Panel>
                        </Collapse>
                      </Col>
                    </Row>
                  </Form.Item>
                )}
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );

  // 在适当的位置添加生命周期管理UI渲染函数
  const renderLifecycleConfig = () => (
    <div className="lifecycle-container">
      <div className="lifecycle-header">
        <Title level={5} className="lifecycle-title">生命周期管理</Title>
        <Tooltip title="配置容器启动后和终止前执行的钩子">
          <InfoCircleOutlined />
          </Tooltip>
        <Form.Item name="enableLifecycle" valuePropName="checked" style={{ marginBottom: 0, marginLeft: 8 }}>
          <Switch 
            onChange={handleLifecycleChange}
            checkedChildren="启用" 
            unCheckedChildren="禁用"
          />
        </Form.Item>
      </div>
      
      {formData.enableLifecycle && (
        <div>
          <Alert
            message="生命周期管理未启用"
            description="启用生命周期管理可以在容器启动后执行初始化动作或终止前执行清理操作"
            type="info"
            showIcon
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="advanced-config">
      <Tabs defaultActiveKey="1">
        <TabPane tab="健康检查" key="1">
          {renderHealthCheckConfig()}
        </TabPane>
        <TabPane tab="生命周期管理" key="2">
          {renderLifecycleConfig()}
        </TabPane>
        <TabPane tab="环境变量" key="3">
          {/* ... 环境变量配置 ... */}
        </TabPane>
        <TabPane tab="存储配置" key="4">
          {/* ... 存储配置 ... */}
        </TabPane>
        <TabPane tab="安全设置" key="5">
          {/* ... 安全设置 ... */}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AdvancedConfig; 