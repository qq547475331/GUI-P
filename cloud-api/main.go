package main

import (
	"cloud-deployment-api/handler"
	"cloud-deployment-api/model"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 设置日志输出
	logFile := setupLogging()
	defer logFile.Close()

	// 初始化数据库连接
	if err := model.InitDB(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// 初始化路由
	r := setupRouter()

	// 启动服务器
	fmt.Println("Server is running on http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

func setupLogging() *os.File {
	// 创建日志目录
	logDir := "logs"
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Fatal("Failed to create log directory:", err)
	}

	// 打开日志文件
	logFile, err := os.OpenFile(filepath.Join(logDir, "app.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal("Failed to open log file:", err)
	}

	// 设置日志输出
	log.SetOutput(logFile)
	return logFile
}

func setupRouter() *gin.Engine {
	r := gin.Default()

	// 配置CORS
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"}
	config.AllowCredentials = true
	config.AddAllowHeaders("Authorization")
	r.Use(cors.New(config))

	// 注册路由
	registerRoutes(r)

	return r
}

func registerRoutes(r *gin.Engine) {
	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API路由组
	api := r.Group("/api")
	{
		// 应用相关路由
		api.POST("/applications", handler.CreateApplication)
		api.GET("/applications", handler.GetApplications)
		api.GET("/applications/:id", handler.GetApplicationByID)
		api.PUT("/applications/:id", handler.UpdateApplication)
		api.DELETE("/applications/:id", handler.DeleteApplication)
		api.POST("/applications/:id/deploy", handler.DeployApplication)
		api.GET("/applications/:id/status", handler.GetDeploymentStatus)
		api.GET("/applications/:id/yaml", handler.ExportApplicationToYaml)

		// Kubernetes资源相关路由
		api.GET("/kubeconfig/:id/namespaces", handler.GetK8sNamespaces)
		api.GET("/kubeconfig/:id/pods", handler.GetK8sPods)
		api.GET("/kubeconfig/:id/deployments", handler.GetK8sDeployments)
		api.GET("/kubeconfig/:id/services", handler.GetK8sServices)
		api.GET("/kubeconfig/:id/statefulsets", handler.GetK8sStatefulSets)
		api.GET("/kubeconfig/:id/daemonsets", handler.GetK8sDaemonSets)
		api.GET("/kubeconfig/:id/jobs", handler.GetK8sJobs)
		api.GET("/kubeconfig/:id/resources", handler.GetK8sResources)
		
		// 添加Kubernetes资源操作API
		// 直接操作特定类型的Kubernetes资源
		api.DELETE("/kubeconfig/:id/:resourceType", handler.DeleteK8sResource)
		
		// 新的统一K8s资源操作API
		api.GET("/k8s/:id/resources/:resourceType", handler.GetK8sResourcesByType)
		api.GET("/k8s/:id/resources/:resourceType/:name", handler.GetK8sResourceByName)
		api.POST("/k8s/:id/resources/:resourceType", handler.CreateK8sResource)
		api.PUT("/k8s/:id/resources/:resourceType/:name", handler.UpdateK8sResource)
		api.DELETE("/k8s/:id/resources/:resourceType", handler.DeleteK8sResource)
		
		// 直接操作部署的API
		api.DELETE("/k8s/:id/deployments", handler.DeleteK8sDeployment)

		// KubeConfig管理路由
		api.POST("/kubeconfig", handler.UploadKubeConfig)
		api.GET("/kubeconfig", handler.GetKubeConfigs)
		api.GET("/kubeconfig/:id", handler.GetKubeConfigByID)
		api.DELETE("/kubeconfig/:id", handler.DeleteKubeConfig)
		api.PUT("/kubeconfig/:id/context", handler.SetKubeConfigContext)

		// 镜像仓库相关路由
		api.GET("/registry", handler.GetImageRegistries)
		api.POST("/registry", handler.CreateImageRegistry)
		api.GET("/registry/:id", handler.GetImageRegistryByID)
		api.PUT("/registry/:id", handler.UpdateImageRegistry)
		api.DELETE("/registry/:id", handler.DeleteImageRegistry)
		api.POST("/registry/test", handler.TestImageRegistry)
		api.GET("/registry/:id/repositories", handler.GetRepositories)
		api.GET("/registry/:id/tags", handler.GetImageTags)
		api.GET("/registry/:id/harborrepo/:project", handler.GetHarborRepositories)
		api.GET("/registry/:id/harbortags/:project/:repository", handler.GetHarborTags)

		// 其他资源路由
		api.GET("/images", handler.GetImages)
		api.GET("/quota", handler.GetResourceQuota)
		api.POST("/price", handler.EstimatePrice)

		// 添加Pod相关路由
		api.GET("/pods", handler.GetPods)
		api.GET("/pods/:name/logs", handler.GetPodLogs)
		api.GET("/pods/exec", handler.ExecPodTerminal) // WebSocket连接
	}
} 