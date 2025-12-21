package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/buffer"
	"go.uber.org/zap/zapcore"
)

var logger *zap.Logger
var sugarLogger *zap.SugaredLogger
var bufferPool = buffer.NewPool()
var logDir string
var currentDate string

// ANSI颜色代码
const (
	ColorReset  = "\033[0m"
	ColorRed    = "\033[31m"
	ColorGreen  = "\033[32m"
	ColorYellow = "\033[33m"
	ColorBlue   = "\033[34m"
	ColorWhite  = "\033[37m"
)

// InitLogger 初始化日志记录器
func InitLogger() {
	// 确保日志目录存在
	logDir = filepath.Clean("./logs/")
	if _, err := os.Stat(logDir); os.IsNotExist(err) {
		err := os.MkdirAll(logDir, 0755)
		if err != nil {
			panic(fmt.Sprintf("创建日志目录失败: %v", err))
		}
	}

	// 获取日志级别
	level := parseLogLevel(AppConfig.Server.Level)

	// 创建控制台输出（带颜色）
	consoleEncoder := getConsoleEncoder(true) // 带颜色
	consoleWriter := zapcore.Lock(os.Stdout)
	consoleCore := zapcore.NewCore(consoleEncoder, consoleWriter, level)

	// 创建文件输出（不带颜色）
	fileEncoder := getConsoleEncoder(false) // 不带颜色

	// 使用带日期的文件名
	currentDate = time.Now().Format("2006-01-02")
	filename := filepath.Join(logDir, fmt.Sprintf("%s.log", currentDate))

	fileWriter := zapcore.AddSync(&LogFileWriter{
		filename: filename,
		file:     nil,
	})

	fileCore := zapcore.NewCore(fileEncoder, fileWriter, level)

	// 创建组合核心
	core := zapcore.NewTee(consoleCore, fileCore)

	// 创建logger
	logger = zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))
	sugarLogger = logger.Sugar()
}

// getConsoleEncoder 获取控制台日志编码器
func getConsoleEncoder(withColor bool) zapcore.Encoder {
	return &customEncoder{
		withColor: withColor,
	}
}

// customEncoder 自定义编码器
type customEncoder struct {
	withColor bool
}

// AddArray 实现ObjectEncoder接口
func (e *customEncoder) AddArray(key string, marshaler zapcore.ArrayMarshaler) error {
	return nil
}

// AddObject 实现ObjectEncoder接口
func (e *customEncoder) AddObject(key string, marshaler zapcore.ObjectMarshaler) error {
	return nil
}

// AddBinary 实现ObjectEncoder接口
func (e *customEncoder) AddBinary(key string, value []byte) {
}

// AddByteString 实现ObjectEncoder接口
func (e *customEncoder) AddByteString(key string, value []byte) {
}

// AddBool 实现ObjectEncoder接口
func (e *customEncoder) AddBool(key string, value bool) {
}

// AddComplex128 实现ObjectEncoder接口
func (e *customEncoder) AddComplex128(key string, value complex128) {
}

// AddComplex64 实现ObjectEncoder接口
func (e *customEncoder) AddComplex64(key string, value complex64) {
}

// AddDuration 实现ObjectEncoder接口
func (e *customEncoder) AddDuration(key string, value time.Duration) {
}

// AddFloat64 实现ObjectEncoder接口
func (e *customEncoder) AddFloat64(key string, value float64) {
}

// AddFloat32 实现ObjectEncoder接口
func (e *customEncoder) AddFloat32(key string, value float32) {
}

// AddInt 实现ObjectEncoder接口
func (e *customEncoder) AddInt(key string, value int) {
}

// AddInt64 实现ObjectEncoder接口
func (e *customEncoder) AddInt64(key string, value int64) {
}

// AddInt32 实现ObjectEncoder接口
func (e *customEncoder) AddInt32(key string, value int32) {
}

// AddInt16 实现ObjectEncoder接口
func (e *customEncoder) AddInt16(key string, value int16) {
}

// AddInt8 实现ObjectEncoder接口
func (e *customEncoder) AddInt8(key string, value int8) {
}

// AddString 实现ObjectEncoder接口
func (e *customEncoder) AddString(key, value string) {
}

// AddTime 实现ObjectEncoder接口
func (e *customEncoder) AddTime(key string, value time.Time) {
}

// AddUint 实现ObjectEncoder接口
func (e *customEncoder) AddUint(key string, value uint) {
}

// AddUint64 实现ObjectEncoder接口
func (e *customEncoder) AddUint64(key string, value uint64) {
}

// AddUint32 实现ObjectEncoder接口
func (e *customEncoder) AddUint32(key string, value uint32) {
}

// AddUint16 实现ObjectEncoder接口
func (e *customEncoder) AddUint16(key string, value uint16) {
}

// AddUint8 实现ObjectEncoder接口
func (e *customEncoder) AddUint8(key string, value uint8) {
}

// AddUintptr 实现ObjectEncoder接口
func (e *customEncoder) AddUintptr(key string, value uintptr) {
}

// AddReflected 实现ObjectEncoder接口
func (e *customEncoder) AddReflected(key string, value interface{}) error {
	return nil
}

// OpenNamespace 实现ObjectEncoder接口
func (e *customEncoder) OpenNamespace(key string) {
}

// Clone 实现Encoder接口
func (e *customEncoder) Clone() zapcore.Encoder {
	return &customEncoder{
		withColor: e.withColor,
	}
}

// EncodeEntry 实现Encoder接口
func (e *customEncoder) EncodeEntry(ent zapcore.Entry, fields []zapcore.Field) (*buffer.Buffer, error) {
	line := bufferPool.Get()

	// 添加时间
	line.AppendString("[" + ent.Time.Format("2006-01-02 15:04:05") + "] ")

	// 添加等级
	levelText := ""
	switch ent.Level {
	case zapcore.DebugLevel:
		levelText = "[DEBUG]"
	case zapcore.InfoLevel:
		levelText = "[INFO]"
	case zapcore.WarnLevel:
		levelText = "[WARN]"
	case zapcore.ErrorLevel:
		levelText = "[ERROR]"
	default:
		levelText = "[UNKNOWN]"
	}

	if e.withColor {
		switch ent.Level {
		case zapcore.DebugLevel:
			line.AppendString(ColorBlue + levelText + ColorReset + " ")
		case zapcore.InfoLevel:
			line.AppendString(ColorGreen + levelText + ColorReset + " ")
		case zapcore.WarnLevel:
			line.AppendString(ColorYellow + levelText + ColorReset + " ")
		case zapcore.ErrorLevel:
			line.AppendString(ColorRed + levelText + ColorReset + " ")
		default:
			line.AppendString(ColorWhite + levelText + ColorReset + " ")
		}
	} else {
		line.AppendString(levelText + " ")
	}

	// 添加调用者信息
	if ent.Caller.Defined {
		line.AppendString("[" + filepath.Base(ent.Caller.File) + ":" + fmt.Sprintf("%d", ent.Caller.Line) + "] ")
	}

	// 添加消息
	line.AppendString(ent.Message)

	// 添加其他字段
	if len(fields) > 0 {
		line.AppendString(" ")
		for i, field := range fields {
			if i > 0 {
				line.AppendString(" ")
			}
			line.AppendString(field.Key + "=" + fmt.Sprintf("%v", field.Interface))
		}
	}

	line.AppendString("\n")
	return line, nil
}

// LogFileWriter 自定义日志文件写入器，支持按天分割
type LogFileWriter struct {
	filename string
	file     *os.File
}

// Write 实现io.Writer接口
func (w *LogFileWriter) Write(data []byte) (n int, err error) {
	// 检查是否需要创建新的日志文件（新的一天）
	nowDate := time.Now().Format("2006-01-02")
	if nowDate != currentDate || w.file == nil {
		// 关闭旧文件
		if w.file != nil {
			w.file.Close()
		}

		// 更新当前日期
		currentDate = nowDate

		// 创建新文件
		w.filename = filepath.Join(logDir, fmt.Sprintf("%s.log", currentDate))
		w.file, err = os.OpenFile(w.filename, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
		if err != nil {
			return 0, err
		}
	}

	return w.file.Write(data)
}

// Sync 实现zapcore.WriteSyncer接口
func (w *LogFileWriter) Sync() error {
	if w.file != nil {
		return w.file.Sync()
	}
	return nil
}

// parseLogLevel 解析日志级别字符串
func parseLogLevel(level string) zapcore.Level {
	switch level {
	case "debug":
		return zapcore.DebugLevel
	case "info":
		return zapcore.InfoLevel
	case "warn":
		return zapcore.WarnLevel
	case "error":
		return zapcore.ErrorLevel
	default:
		return zapcore.DebugLevel
	}
}

// Debug 记录Debug级别日志
func Debug(args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Debug(args...)
	}
}

// Debugf 记录Debug级别格式化日志
func Debugf(template string, args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Debugf(template, args...)
	}
}

// Info 记录Info级别日志
func Info(args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Info(args...)
	}
}

// Infof 记录Info级别格式化日志
func Infof(template string, args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Infof(template, args...)
	}
}

// Warn 记录Warn级别日志
func Warn(args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Warn(args...)
	}
}

// Warnf 记录Warn级别格式化日志
func Warnf(template string, args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Warnf(template, args...)
	}
}

// Error 记录Error级别日志
func Error(args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Error(args...)
	}
}

// Errorf 记录Error级别格式化日志
func Errorf(template string, args ...interface{}) {
	if sugarLogger != nil {
		sugarLogger.Errorf(template, args...)
	}
}

// Sync 同步日志缓冲区
func Sync() {
	if logger != nil {
		logger.Sync()
	}
}
