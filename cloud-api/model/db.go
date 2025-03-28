package model

import (
	"fmt"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

var (
	// DB 全局数据库连接
	DB *sqlx.DB
)

// 数据库连接配置
const (
	dbHost     = "192.168.0.61"
	dbPort     = 30054
	dbUser     = "admin" 
	dbPassword = "asd123456"
	dbName     = "clouddb"
	dbSchema   = "public"
	maxRetries = 3        // 最大重试次数
	retryDelay = 3        // 重试延迟秒数
)

// InitDB 初始化数据库连接
func InitDB() error {
	connStr := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable search_path=%s connect_timeout=10",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSchema)
	
	var err error
	var retryCount int
	
	// 带重试的数据库连接
	for retryCount < maxRetries {
		log.Printf("尝试连接数据库 (尝试 %d/%d)...", retryCount+1, maxRetries)
		
		DB, err = sqlx.Connect("postgres", connStr)
		if err == nil {
			break // 连接成功
		}
		
		log.Printf("连接数据库失败: %v，将在 %d 秒后重试", err, retryDelay)
		time.Sleep(time.Duration(retryDelay) * time.Second)
		retryCount++
	}
	
	if err != nil {
		return fmt.Errorf("连接数据库失败，已重试 %d 次: %v", retryCount, err)
	}
	
	// 设置连接池参数
	DB.SetMaxOpenConns(25)     // 最大打开连接数
	DB.SetMaxIdleConns(10)     // 最大空闲连接数
	DB.SetConnMaxLifetime(10 * time.Minute) // 连接最大生命周期
	DB.SetConnMaxIdleTime(5 * time.Minute)  // 连接最大空闲时间
	
	// 测试连接
	if err := DB.Ping(); err != nil {
		return fmt.Errorf("数据库Ping失败: %v", err)
	}

	log.Println("成功连接到PostgreSQL数据库")
	
	// 验证必要的表是否存在
	if err := verifyTables(); err != nil {
		return fmt.Errorf("验证数据库表失败: %v", err)
	}
	
	return nil
}

// verifyTables 验证必要的数据库表是否存在
func verifyTables() error {
	tables := []string{"kube_configs", "applications", "kubernetes_resources"}
	
	for _, table := range tables {
		var exists bool
		query := `
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = $1 
				AND table_name = $2
			);
		`
		err := DB.Get(&exists, query, dbSchema, table)
		if err != nil {
			return fmt.Errorf("检查表 %s 是否存在时出错: %v", table, err)
		}
		
		if !exists {
			return fmt.Errorf("必要的表 %s 不存在", table)
		}
	}
	
	log.Println("所有必要的数据库表都已就绪")
	return nil
} 