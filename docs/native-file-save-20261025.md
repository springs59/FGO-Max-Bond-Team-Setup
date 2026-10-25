# 原生队伍档案保存

Android WebView 不会像系统浏览器一样自动处理页面的 Blob 下载。报告和完整 JSONL 现在通过 `native/shared/file-save.js` 统一保存：网页与 Electron 仍使用浏览器下载，Android 使用系统 `ACTION_CREATE_DOCUMENT` 选择目标文件。

安卓保存消息使用 WebViewCompat 的 origin allowlist，仅限本机应用 HTTPS origin 与主页面，不给 iframe 或外部网页提供保存入口。没有通用路径读写接口，不新增存储权限，只向用户在系统窗口选中的 URI 写入。取消系统窗口、存储错误或不完整写入均不会显示保存成功。

HTML、PNG、PDF、DOCX、JSON、JSONL 均使用最多 48 KiB 的数据块，每块确认完成后才发送下一块。完整 JSONL 直接读取 Blob URL 的响应流，不先调用 `arrayBuffer()` 或 `blob()` 复制整个大文件。失败会关闭输出流；应用/渲染器退出会结束正在进行的保存。没有设置账号或长查询的时间限制。

原生 CSP 只增加本机 Blob 读取，以及应用已使用的 Atlas 公共图片/灵基接口连接，不加入任意网络来源或内联脚本权限。导出图片读取不到在线图像时仍保留名称、灵基、栏位和满破。

验证包括共享保存模块的字节一致性、单块在途、取消/异常和不支持环境；真实 Android WebView 的六种格式通过系统创建文件 Intent 与选中 URI，逐字节校验 200001 字节的分块结果；真实 Electron 在生产 CSP、导航约束下保存五种报告格式与 Worker 创建的 JSONL。

发布验证额外比较 APK 内的保存模块、同分浏览、报告及对比源码与锁定提交，沿用原签名和递增的 Android versionCode。
