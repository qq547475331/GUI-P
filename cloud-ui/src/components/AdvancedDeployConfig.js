import React, { useState } from 'react';
import { 
  Card, 
  Collapse, 
  Form, 
  Input, 
  Switch, 
  Select, 
  InputNumber, 
  Radio, 
  Space, 
  Button, 
  Divider,
  Typography,
  Tooltip,
  Row,
  Col
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  InfoCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  DatabaseOutlined,
  SettingOutlined,
  TagsOutlined,
  NodeIndexOutlined
} from '@ant-design/icons';
import './AdvancedDeployConfig.css';

const { Panel } = Collapse;
const { Option } = Select;
const { Text, Title } = Typography;

const AdvancedDeployConfig = ({ form }) => {
  // 更新策略选项状态
  const [updateStrategy, setUpdateStrategy] = useState('RollingUpdate');
  
  // 健康检查类型状态
  const [livenessType, setLivenessType] = useState('http');
  const [readinessType, setReadinessType] = useState('http');
  const [startupType, setStartupType] = useState('http');
  
  return (
    <Card title="高级配置选项" className="advanced-deploy-config">
      <Collapse bordered={false} defaultActiveKey={[]}>
        {/* 更新策略配置 */}
        <Panel 
          header={
            <span>
              <UploadOutlined style={{marginRight: 8}} />
              更新策略
            </span>
          } 
          key="updateStrategy"
        >
          <Form.Item name="updateStrategy" initialValue="RollingUpdate">
            <Radio.Group onChange={e => setUpdateStrategy(e.target.value)}>
              <Space direction="vertical">
                <Radio value="RollingUpdate">
                  <Text strong>滚动更新（推荐）</Text>
                  <div className="option-desc">用新容器组副本逐步替换旧副本，确保业务不会中断</div>
                </Radio>
                <Radio value="Recreate">
                  <Text strong>重建更新</Text>
                  <div className="option-desc">先删除所有旧容器组，再创建新容器组（会导致服务中断）</div>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          
          {updateStrategy === 'RollingUpdate' && (
            <div className="update-config-form">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item 
                    name={['rollingUpdate', 'maxUnavailable']} 
                    label="最大不可用" 
                    initialValue="25%"
                    tooltip="更新过程中允许的最大不可用Pod数量或百分比"
                  >
                    <Input placeholder="25%" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    name={['rollingUpdate', 'maxSurge']} 
                    label="最大超量" 
                    initialValue="25%"
                    tooltip="更新过程中允许的最大超出期望Pod数量的数量或百分比"
                  >
                    <Input placeholder="25%" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}
        </Panel>
        
        {/* 健康检查配置 */}
        <Panel 
          header={
            <span>
              <SafetyCertificateOutlined style={{marginRight: 8}} />
              健康检查
            </span>
          } 
          key="healthCheck"
        >
          <Collapse bordered={false} ghost defaultActiveKey={[]}>
            {/* 存活检查 */}
            <Panel header="存活检查 (Liveness Probe)" key="liveness">
              <Form.Item 
                name={['livenessProbe', 'enabled']} 
                valuePropName="checked"
                initialValue={false}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
              
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => 
                prevValues.livenessProbe?.enabled !== currentValues.livenessProbe?.enabled
              }>
                {({ getFieldValue }) => 
                  getFieldValue(['livenessProbe', 'enabled']) && (
                    <div className="probe-config">
                      <Form.Item name={['livenessProbe', 'probeType']} label="检查类型" initialValue="http">
                        <Radio.Group onChange={e => setLivenessType(e.target.value)}>
                          <Radio value="http">HTTP请求</Radio>
                          <Radio value="tcp">TCP端口</Radio>
                          <Radio value="command">命令</Radio>
                        </Radio.Group>
                      </Form.Item>
                      
                      {/* HTTP检查类型 */}
                      {livenessType === 'http' && (
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item 
                              name={['livenessProbe', 'path']} 
                              label="路径"
                              initialValue="/"
                              rules={[{ required: true, message: '请输入检查路径' }]}
                            >
                              <Input placeholder="/" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item 
                              name={['livenessProbe', 'port']} 
                              label="端口"
                              initialValue={8080}
                              rules={[{ required: true, message: '请输入端口' }]}
                            >
                              <InputNumber min={1} max={65535} style={{width: '100%'}} />
                            </Form.Item>
                          </Col>
                        </Row>
                      )}
                      
                      {/* TCP检查类型 */}
                      {livenessType === 'tcp' && (
                        <Form.Item 
                          name={['livenessProbe', 'port']} 
                          label="端口"
                          initialValue={8080}
                          rules={[{ required: true, message: '请输入端口' }]}
                        >
                          <InputNumber min={1} max={65535} style={{width: '100%'}} />
                        </Form.Item>
                      )}
                      
                      {/* 命令检查类型 */}
                      {livenessType === 'command' && (
                        <Form.Item 
                          name={['livenessProbe', 'command']} 
                          label="命令"
                          rules={[{ required: true, message: '请输入命令' }]}
                        >
                          <Input placeholder="使用逗号分隔命令，例如: /bin/sh,-c,cat /tmp/healthy" />
                        </Form.Item>
                      )}
                      
                      <Divider dashed />
                      <Title level={5}>高级参数设置</Title>
                      
                      <Row gutter={16}>
                        <Col span={6}>
                          <Form.Item 
                            name={['livenessProbe', 'initialDelaySeconds']} 
                            label="初始延迟(秒)" 
                            initialValue={0}
                            tooltip="容器启动后到开始探测的延迟时间"
                          >
                            <InputNumber min={0} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['livenessProbe', 'periodSeconds']} 
                            label="检查间隔(秒)" 
                            initialValue={10}
                            tooltip="两次探测的间隔时间"
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['livenessProbe', 'timeoutSeconds']} 
                            label="超时时间(秒)" 
                            initialValue={1}
                            tooltip="探测超时时间"
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['livenessProbe', 'failureThreshold']} 
                            label="失败阈值" 
                            initialValue={3}
                            tooltip="连续失败多少次视为检测失败"
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  )
                }
              </Form.Item>
            </Panel>
            
            {/* 就绪检查 */}
            <Panel header="就绪检查 (Readiness Probe)" key="readiness">
              <Form.Item 
                name={['readinessProbe', 'enabled']} 
                valuePropName="checked"
                initialValue={false}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
              
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => 
                prevValues.readinessProbe?.enabled !== currentValues.readinessProbe?.enabled
              }>
                {({ getFieldValue }) => 
                  getFieldValue(['readinessProbe', 'enabled']) && (
                    <div className="probe-config">
                      <Form.Item name={['readinessProbe', 'probeType']} label="检查类型" initialValue="http">
                        <Radio.Group onChange={e => setReadinessType(e.target.value)}>
                          <Radio value="http">HTTP请求</Radio>
                          <Radio value="tcp">TCP端口</Radio>
                          <Radio value="command">命令</Radio>
                        </Radio.Group>
                      </Form.Item>
                      
                      {/* HTTP检查类型 */}
                      {readinessType === 'http' && (
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item 
                              name={['readinessProbe', 'path']} 
                              label="路径"
                              initialValue="/"
                              rules={[{ required: true, message: '请输入检查路径' }]}
                            >
                              <Input placeholder="/" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item 
                              name={['readinessProbe', 'port']} 
                              label="端口"
                              initialValue={8080}
                              rules={[{ required: true, message: '请输入端口' }]}
                            >
                              <InputNumber min={1} max={65535} style={{width: '100%'}} />
                            </Form.Item>
                          </Col>
                        </Row>
                      )}
                      
                      {/* TCP检查类型 */}
                      {readinessType === 'tcp' && (
                        <Form.Item 
                          name={['readinessProbe', 'port']} 
                          label="端口"
                          initialValue={8080}
                          rules={[{ required: true, message: '请输入端口' }]}
                        >
                          <InputNumber min={1} max={65535} style={{width: '100%'}} />
                        </Form.Item>
                      )}
                      
                      {/* 命令检查类型 */}
                      {readinessType === 'command' && (
                        <Form.Item 
                          name={['readinessProbe', 'command']} 
                          label="命令"
                          rules={[{ required: true, message: '请输入命令' }]}
                        >
                          <Input placeholder="使用逗号分隔命令，例如: /bin/sh,-c,cat /tmp/ready" />
                        </Form.Item>
                      )}
                      
                      <Divider dashed />
                      <Title level={5}>高级参数设置</Title>
                      
                      <Row gutter={16}>
                        <Col span={6}>
                          <Form.Item 
                            name={['readinessProbe', 'initialDelaySeconds']} 
                            label="初始延迟(秒)" 
                            initialValue={0}
                          >
                            <InputNumber min={0} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['readinessProbe', 'periodSeconds']} 
                            label="检查间隔(秒)" 
                            initialValue={10}
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['readinessProbe', 'timeoutSeconds']} 
                            label="超时时间(秒)" 
                            initialValue={1}
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['readinessProbe', 'failureThreshold']} 
                            label="失败阈值" 
                            initialValue={3}
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  )
                }
              </Form.Item>
            </Panel>
            
            {/* 启动检查 */}
            <Panel header="启动检查 (Startup Probe)" key="startup">
              <Form.Item 
                name={['startupProbe', 'enabled']} 
                valuePropName="checked"
                initialValue={false}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
              
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => 
                prevValues.startupProbe?.enabled !== currentValues.startupProbe?.enabled
              }>
                {({ getFieldValue }) => 
                  getFieldValue(['startupProbe', 'enabled']) && (
                    <div className="probe-config">
                      <Form.Item name={['startupProbe', 'probeType']} label="检查类型" initialValue="http">
                        <Radio.Group onChange={e => setStartupType(e.target.value)}>
                          <Radio value="http">HTTP请求</Radio>
                          <Radio value="tcp">TCP端口</Radio>
                          <Radio value="command">命令</Radio>
                        </Radio.Group>
                      </Form.Item>
                      
                      {/* HTTP检查类型 */}
                      {startupType === 'http' && (
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item 
                              name={['startupProbe', 'path']} 
                              label="路径"
                              initialValue="/"
                              rules={[{ required: true, message: '请输入检查路径' }]}
                            >
                              <Input placeholder="/" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item 
                              name={['startupProbe', 'port']} 
                              label="端口"
                              initialValue={8080}
                              rules={[{ required: true, message: '请输入端口' }]}
                            >
                              <InputNumber min={1} max={65535} style={{width: '100%'}} />
                            </Form.Item>
                          </Col>
                        </Row>
                      )}
                      
                      {/* TCP检查类型 */}
                      {startupType === 'tcp' && (
                        <Form.Item 
                          name={['startupProbe', 'port']} 
                          label="端口"
                          initialValue={8080}
                          rules={[{ required: true, message: '请输入端口' }]}
                        >
                          <InputNumber min={1} max={65535} style={{width: '100%'}} />
                        </Form.Item>
                      )}
                      
                      {/* 命令检查类型 */}
                      {startupType === 'command' && (
                        <Form.Item 
                          name={['startupProbe', 'command']} 
                          label="命令"
                          rules={[{ required: true, message: '请输入命令' }]}
                        >
                          <Input placeholder="使用逗号分隔命令，例如: /bin/sh,-c,cat /tmp/started" />
                        </Form.Item>
                      )}
                      
                      <Divider dashed />
                      <Title level={5}>高级参数设置</Title>
                      
                      <Row gutter={16}>
                        <Col span={6}>
                          <Form.Item 
                            name={['startupProbe', 'initialDelaySeconds']} 
                            label="初始延迟(秒)" 
                            initialValue={0}
                          >
                            <InputNumber min={0} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['startupProbe', 'periodSeconds']} 
                            label="检查间隔(秒)" 
                            initialValue={10}
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['startupProbe', 'timeoutSeconds']} 
                            label="超时时间(秒)" 
                            initialValue={1}
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item 
                            name={['startupProbe', 'failureThreshold']} 
                            label="失败阈值" 
                            initialValue={30}
                            tooltip="慢启动应用建议设置较大值，如30"
                          >
                            <InputNumber min={1} style={{width: '100%'}} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  )
                }
              </Form.Item>
            </Panel>
          </Collapse>
        </Panel>
        
        {/* 生命周期管理配置 */}
        <Panel 
          header={
            <span>
              <ClockCircleOutlined style={{marginRight: 8}} />
              生命周期管理
            </span>
          } 
          key="lifecycle"
        >
          <Collapse bordered={false} ghost defaultActiveKey={[]}>
            {/* 启动后操作 */}
            <Panel header="启动后操作 (PostStart)" key="postStart">
              <Form.Item 
                name={['lifecycle', 'postStart', 'enabled']} 
                valuePropName="checked"
                initialValue={false}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
              
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => 
                prevValues.lifecycle?.postStart?.enabled !== currentValues.lifecycle?.postStart?.enabled
              }>
                {({ getFieldValue }) => 
                  getFieldValue(['lifecycle', 'postStart', 'enabled']) && (
                    <Form.Item 
                      name={['lifecycle', 'postStart', 'command']} 
                      label="执行命令"
                      rules={[{ required: true, message: '请输入命令' }]}
                    >
                      <Input placeholder="使用逗号分隔命令，例如: /bin/sh,-c,echo 'Container is starting...'" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Panel>
            
            {/* 停止前操作 */}
            <Panel header="停止前操作 (PreStop)" key="preStop">
              <Form.Item 
                name={['lifecycle', 'preStop', 'enabled']} 
                valuePropName="checked"
                initialValue={false}
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
              
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => 
                prevValues.lifecycle?.preStop?.enabled !== currentValues.lifecycle?.preStop?.enabled
              }>
                {({ getFieldValue }) => 
                  getFieldValue(['lifecycle', 'preStop', 'enabled']) && (
                    <Form.Item 
                      name={['lifecycle', 'preStop', 'command']} 
                      label="执行命令"
                      rules={[{ required: true, message: '请输入命令' }]}
                    >
                      <Input placeholder="使用逗号分隔命令，例如: /bin/sh,-c,sleep 10 && echo 'Graceful shutdown'" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Panel>
          </Collapse>
        </Panel>
        
        {/* 启动命令 */}
        <Panel 
          header={
            <span>
              <UploadOutlined style={{marginRight: 8}} />
              启动命令
            </span>
          } 
          key="command"
        >
          <Form.Item 
            name="useCustomCommand" 
            valuePropName="checked"
            initialValue={false}
          >
            <Switch checkedChildren="自定义启动命令" unCheckedChildren="使用默认启动命令" />
          </Form.Item>
          
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => 
            prevValues.useCustomCommand !== currentValues.useCustomCommand
          }>
            {({ getFieldValue }) => 
              getFieldValue('useCustomCommand') && (
                <div className="command-config">
                  <Form.Item 
                    name="command" 
                    label="启动命令"
                    rules={[{ required: true, message: '请输入启动命令' }]}
                    extra="使用逗号分隔多个命令，例如: /bin/sh,-c,echo 'Starting...'"
                  >
                    <Input placeholder="/bin/sh,-c,echo 'Starting...'" />
                  </Form.Item>
                  <Form.Item 
                    name="args" 
                    label="启动参数"
                    extra="使用逗号分隔多个参数"
                  >
                    <Input placeholder="参数1,参数2,参数3" />
                  </Form.Item>
                </div>
              )
            }
          </Form.Item>
        </Panel>
        
        {/* 环境变量 */}
        <Panel 
          header={
            <span>
              <SettingOutlined style={{marginRight: 8}} />
              环境变量
            </span>
          } 
          key="env"
        >
          <Form.List name="envVars">
            {(fields, { add, remove }) => (
              <>
                {fields.map(field => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...field}
                      name={[field.name, 'name']}
                      fieldKey={[field.fieldKey, 'name']}
                      rules={[{ required: true, message: '请输入变量名' }]}
                    >
                      <Input placeholder="变量名" style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'value']}
                      fieldKey={[field.fieldKey, 'value']}
                      rules={[{ required: true, message: '请输入变量值' }]}
                    >
                      <Input placeholder="变量值" style={{ width: 200 }} />
                    </Form.Item>
                    <DeleteOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加环境变量
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Panel>
        
        {/* 存储设置 */}
        <Panel 
          header={
            <span>
              <DatabaseOutlined style={{marginRight: 8}} />
              存储设置
            </span>
          }
          key="storage"
        >
          <Form.List name="volumes">
            {(fields, { add, remove }) => (
              <>
                {fields.map(field => (
                  <Card key={field.key} className="volume-card" style={{ marginBottom: 16 }}>
                    <Form.Item
                      {...field}
                      name={[field.name, 'name']}
                      fieldKey={[field.fieldKey, 'name']}
                      label="卷名称"
                      rules={[{ required: true, message: '请输入卷名称' }]}
                    >
                      <Input placeholder="volume-data" />
                    </Form.Item>
                    
                    <Form.Item
                      {...field}
                      name={[field.name, 'type']}
                      fieldKey={[field.fieldKey, 'type']}
                      label="卷类型"
                      rules={[{ required: true, message: '请选择卷类型' }]}
                      initialValue="emptyDir"
                    >
                      <Select placeholder="选择卷类型">
                        <Option value="emptyDir">临时卷 (emptyDir)</Option>
                        <Option value="hostPath">主机路径 (hostPath)</Option>
                        <Option value="configMap">配置字典 (ConfigMap)</Option>
                        <Option value="secret">保密字典 (Secret)</Option>
                        <Option value="pvc">持久卷声明 (PVC)</Option>
                      </Select>
                    </Form.Item>
                    
                    <Form.Item noStyle shouldUpdate>
                      {({ getFieldValue }) => {
                        const type = getFieldValue(['volumes', field.name, 'type']);
                        
                        return (
                          <>
                            {type === 'hostPath' && (
                              <Form.Item
                                {...field}
                                name={[field.name, 'hostPath']}
                                fieldKey={[field.fieldKey, 'hostPath']}
                                label="主机路径"
                                rules={[{ required: true, message: '请输入主机路径' }]}
                              >
                                <Input placeholder="/data/volume1" />
                              </Form.Item>
                            )}
                            
                            {type === 'configMap' && (
                              <Form.Item
                                {...field}
                                name={[field.name, 'configMap']}
                                fieldKey={[field.fieldKey, 'configMap']}
                                label="配置字典名称"
                                rules={[{ required: true, message: '请输入配置字典名称' }]}
                              >
                                <Input placeholder="my-config" />
                              </Form.Item>
                            )}
                            
                            {type === 'secret' && (
                              <Form.Item
                                {...field}
                                name={[field.name, 'secret']}
                                fieldKey={[field.fieldKey, 'secret']}
                                label="保密字典名称"
                                rules={[{ required: true, message: '请输入保密字典名称' }]}
                              >
                                <Input placeholder="my-secret" />
                              </Form.Item>
                            )}
                            
                            {type === 'pvc' && (
                              <Form.Item
                                {...field}
                                name={[field.name, 'claimName']}
                                fieldKey={[field.fieldKey, 'claimName']}
                                label="持久卷声明名称"
                                rules={[{ required: true, message: '请输入持久卷声明名称' }]}
                              >
                                <Input placeholder="my-pvc" />
                              </Form.Item>
                            )}
                          </>
                        );
                      }}
                    </Form.Item>
                    
                    <Form.Item
                      {...field}
                      name={[field.name, 'mountPath']}
                      fieldKey={[field.fieldKey, 'mountPath']}
                      label="挂载路径"
                      rules={[{ required: true, message: '请输入挂载路径' }]}
                    >
                      <Input placeholder="/data" />
                    </Form.Item>
                    
                    <Form.Item
                      {...field}
                      name={[field.name, 'readOnly']}
                      fieldKey={[field.fieldKey, 'readOnly']}
                      label="只读挂载"
                      valuePropName="checked"
                      initialValue={false}
                    >
                      <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                    
                    <Button 
                      danger 
                      icon={<DeleteOutlined />} 
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  </Card>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加存储卷
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Panel>
        
        {/* 节点选择器 */}
        <Panel 
          header={
            <span>
              <NodeIndexOutlined style={{marginRight: 8}} />
              节点选择
            </span>
          } 
          key="nodeSelector"
        >
          <Form.List name="nodeSelector">
            {(fields, { add, remove }) => (
              <>
                {fields.map(field => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...field}
                      name={[field.name, 'key']}
                      fieldKey={[field.fieldKey, 'key']}
                      rules={[{ required: true, message: '请输入标签键' }]}
                    >
                      <Input placeholder="kubernetes.io/hostname" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'value']}
                      fieldKey={[field.fieldKey, 'value']}
                      rules={[{ required: true, message: '请输入标签值' }]}
                    >
                      <Input placeholder="node1" style={{ width: 150 }} />
                    </Form.Item>
                    <DeleteOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加节点选择器
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Panel>
        
        {/* 元数据标签 */}
        <Panel 
          header={
            <span>
              <TagsOutlined style={{marginRight: 8}} />
              元数据标签
            </span>
          } 
          key="metadata"
        >
          <Collapse bordered={false} ghost defaultActiveKey={[]}>
            {/* 标签 */}
            <Panel header="标签 (Labels)" key="labels">
              <Form.List name="labels">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(field => (
                      <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...field}
                          name={[field.name, 'key']}
                          fieldKey={[field.fieldKey, 'key']}
                          rules={[{ required: true, message: '请输入标签键' }]}
                        >
                          <Input placeholder="标签键" style={{ width: 150 }} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'value']}
                          fieldKey={[field.fieldKey, 'value']}
                          rules={[{ required: true, message: '请输入标签值' }]}
                        >
                          <Input placeholder="标签值" style={{ width: 150 }} />
                        </Form.Item>
                        <DeleteOutlined onClick={() => remove(field.name)} />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        添加标签
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Panel>
            
            {/* 注解 */}
            <Panel header="注解 (Annotations)" key="annotations">
              <Form.List name="annotations">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(field => (
                      <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...field}
                          name={[field.name, 'key']}
                          fieldKey={[field.fieldKey, 'key']}
                          rules={[{ required: true, message: '请输入注解键' }]}
                        >
                          <Input placeholder="注解键" style={{ width: 150 }} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'value']}
                          fieldKey={[field.fieldKey, 'value']}
                          rules={[{ required: true, message: '请输入注解值' }]}
                        >
                          <Input placeholder="注解值" style={{ width: 150 }} />
                        </Form.Item>
                        <DeleteOutlined onClick={() => remove(field.name)} />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        添加注解
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Panel>
          </Collapse>
        </Panel>
        
        {/* 主机时区同步 */}
        <Panel 
          header={
            <span>
              <ClockCircleOutlined style={{marginRight: 8}} />
              主机时区同步
            </span>
          } 
          key="timezone"
        >
          <Form.Item 
            name="syncHostTimezone" 
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="同步主机时区" unCheckedChildren="使用容器默认时区" />
          </Form.Item>
          
          <div className="timezone-info">
            将挂载主机的 /etc/localtime 到容器的 /etc/localtime，确保容器与主机时区一致
          </div>
        </Panel>
      </Collapse>
    </Card>
  );
};

export default AdvancedDeployConfig; 