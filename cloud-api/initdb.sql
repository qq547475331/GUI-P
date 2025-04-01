CREATE TABLE kube_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,  -- 存储kubeconfig内容
    current_context VARCHAR(100) NOT NULL,
    server_url VARCHAR(255),  -- 集群API服务器URL
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_kube_configs_name ON kube_configs(name);

CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    namespace VARCHAR(100) NOT NULL DEFAULT 'default',
    kube_config_id UUID NOT NULL REFERENCES kube_configs(id),
    description TEXT,
    status VARCHAR(50) DEFAULT 'created',  -- created, running, error, deleted
    image_url VARCHAR(255),
    deployment_yaml TEXT,  -- 存储部署使用的YAML
    replicas INTEGER DEFAULT 1,
    port INTEGER,
    service_type VARCHAR(20) DEFAULT 'ClusterIP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_app_name_namespace_kubeconfig UNIQUE(name, namespace, kube_config_id),
    liveness_probe_json TEXT,
    readiness_probe_json TEXT,
    startup_probe_json TEXT,
    lifecycle_json TEXT,
    command_json TEXT,
    args_json TEXT,
    env_vars_json TEXT,
    security_context_json TEXT,
    node_selector_json TEXT,
    tolerations_json TEXT,
    affinity_json TEXT,
    volumes_json TEXT,
    volume_mounts_json TEXT,
    sync_host_timezone BOOLEAN DEFAULT false,
    update_strategy VARCHAR(64) DEFAULT 'RollingUpdate',
    rolling_update_json TEXT,
    labels_json TEXT,
    annotations_json TEXT
);

-- 索引
CREATE INDEX idx_applications_kube_config_id ON applications(kube_config_id);
CREATE INDEX idx_applications_name_namespace ON applications(name, namespace);

CREATE TABLE kubernetes_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id),
    resource_type VARCHAR(50) NOT NULL,  -- deployment, service, configmap, etc.
    resource_name VARCHAR(100) NOT NULL,
    namespace VARCHAR(100) NOT NULL,
    resource_yaml TEXT,  -- 存储资源的YAML定义
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_resource UNIQUE(application_id, resource_type, resource_name, namespace)
);

-- 索引
CREATE INDEX idx_kubernetes_resources_app_id ON kubernetes_resources(application_id);
CREATE INDEX idx_kubernetes_resources_type_name ON kubernetes_resources(resource_type, resource_name);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为表添加更新时间戳触发器
CREATE TRIGGER update_kube_configs_timestamp
BEFORE UPDATE ON kube_configs
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_applications_timestamp
BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_kubernetes_resources_timestamp
BEFORE UPDATE ON kubernetes_resources
FOR EACH ROW EXECUTE FUNCTION update_timestamp();
