-- 为applications表添加高级部署选项字段

-- 镜像拉取策略
ALTER TABLE applications ADD COLUMN IF NOT EXISTS image_pull_policy VARCHAR(20) DEFAULT 'IfNotPresent';

-- 健康检查: 存活探针、就绪探针、启动探针
ALTER TABLE applications ADD COLUMN IF NOT EXISTS liveness_probe_json TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS readiness_probe_json TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS startup_probe_json TEXT DEFAULT NULL;

-- 生命周期钩子
ALTER TABLE applications ADD COLUMN IF NOT EXISTS lifecycle_json TEXT DEFAULT NULL;

-- 启动命令和参数
ALTER TABLE applications ADD COLUMN IF NOT EXISTS command_json TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS args_json TEXT DEFAULT NULL;

-- 环境变量
ALTER TABLE applications ADD COLUMN IF NOT EXISTS env_vars_json TEXT DEFAULT NULL;

-- 安全上下文
ALTER TABLE applications ADD COLUMN IF NOT EXISTS security_context_json TEXT DEFAULT NULL;

-- 调度规则
ALTER TABLE applications ADD COLUMN IF NOT EXISTS node_selector_json TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tolerations_json TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS affinity_json TEXT DEFAULT NULL;

-- 存储设置
ALTER TABLE applications ADD COLUMN IF NOT EXISTS volumes_json TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS volume_mounts_json TEXT DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN applications.image_pull_policy IS '镜像拉取策略: Always, Never, IfNotPresent';
COMMENT ON COLUMN applications.liveness_probe_json IS '存活探针配置 (JSON)';
COMMENT ON COLUMN applications.readiness_probe_json IS '就绪探针配置 (JSON)';
COMMENT ON COLUMN applications.startup_probe_json IS '启动探针配置 (JSON)';
COMMENT ON COLUMN applications.lifecycle_json IS '生命周期钩子 (JSON)';
COMMENT ON COLUMN applications.command_json IS '容器启动命令 (JSON array)';
COMMENT ON COLUMN applications.args_json IS '容器启动参数 (JSON array)';
COMMENT ON COLUMN applications.env_vars_json IS '环境变量 (JSON array)';
COMMENT ON COLUMN applications.security_context_json IS '安全上下文配置 (JSON)';
COMMENT ON COLUMN applications.node_selector_json IS '节点选择器 (JSON)';
COMMENT ON COLUMN applications.tolerations_json IS '容忍配置 (JSON array)';
COMMENT ON COLUMN applications.affinity_json IS '亲和性配置 (JSON)';
COMMENT ON COLUMN applications.volumes_json IS '卷配置 (JSON array)';
COMMENT ON COLUMN applications.volume_mounts_json IS '卷挂载配置 (JSON array)'; 