# The Principia



AI图像识别并转成LaTeX/markdown格式

由[Zhen-WushuiLingchun](https://github.com/Zhen-WushuiLingchun)/[principia](https://github.com/Zhen-WushuiLingchun/principia)开发而成

![](https://github.com/Qiyao-sudo/principia/blob/main/images/icon.png)

核心功能：AI文字+公式识别并转成文档，解决课堂/作业/科研等场景下LaTeX/Markdown录入不便的问题，可用于试卷识别，公式录入等。

主要功能：

混合输入：支持“常规文本打字 + 复杂公式手写”，利用多模态AI实现超越OCR的高精度识别与逻辑纠错。

智能辅助：内置上下文感知的AI解释功能，支持详细公式推导及多语言输出（课堂防断片）；并可利用多模态能力生成可视化代码。

格式互转：调用轻量级文本模型，实现TeX与MD格式的精准语义转换。

图片公式识别：支持上传包含数学公式的图片，自动识别并转换为可编辑的LaTeX格式。

函数图像绘画：增强的函数图像绘制功能，支持多函数绘制、参数调整、实时数据显示和缩放平移。

历史记录：自动保存操作历史，支持查看、搜索、重新编辑和删除历史记录。

常用数学公式表格：按类别组织的常用数学公式参考，支持一键插入公式。

性能优化：实现缓存机制和渲染优化，提高模型生成速度，减少等待时间。

本地化支持：完整的中英文界面切换，所有生成内容会根据选择的语言自动调整。

安全与展望：当前API Key经服务端中转，建议自行改为前端直连或本地部署以保障安全。未来视空闲情况，计划封装为插件或App。

具体情况和内容见[更新日志](CHANGELOG.md)

***实际使用测试***

<big>**Latex/Md格式编译**

![](https://github.com/Qiyao-sudo/principia/blob/main/images/01.png)

<big>**手写文字识别**

![](https://github.com/Qiyao-sudo/principia/blob/main/images/02.png)



<big>**图片识别**

![](https://github.com/Qiyao-sudo/principia/blob/main/images/03.png)



<big>**暗色模式**

![](https://github.com/Qiyao-sudo/principia/blob/main/images/04.png)



<big>**预置数学公式**

![](https://github.com/Qiyao-sudo/principia/blob/main/images/05.png)



<big>**比较复杂的可视化（伪转动 boost）**

![](https://github.com/Qiyao-sudo/principia/blob/main/images/04.jpg)



<big>**识别函数图像，生成能用的tex代码（下载后用XeLaTeX等编译）**

![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/IMG_20251223_122625.jpg)
![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/IMG_20251223_122710.jpg)


