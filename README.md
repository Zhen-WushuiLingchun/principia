# The Principia 
*这名字也是AI起的

查了一下当时开发用的名字principia貌似就被人用过了，于是这里改成了The Principia（似乎还更有高级感了
借助Gemini进行初步设计，接着完全通过TRAE开发的一个AI手写识别并转成LaTeX/markdown格式的项目，并且在网页端可以实时通过AI解释相应的公式

具体细节见附带的别的markdown文件

![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/%E5%9B%BE.png)

这个是Nano Banana Pro生成的图标，感觉还行，就用到这里了

这个作为仅有三四个小时（TRAE on Campus的Vibe Coding Workshop的时间要求），并且采用100% AI开发的一个小项目，有一些bug或者不完善的地方是在所难免的，请见谅（

核心痛点：解决课堂等场景下LaTeX/Markdown录入不便的问题。

主要功能：

混合输入：支持“常规文本打字 + 复杂公式手写”，利用多模态AI实现超越OCR的高精度识别与逻辑纠错。

智能辅助：内置上下文感知的AI解释功能，支持详细公式推导及多语言输出（课堂防断片）；并可利用多模态能力生成可视化代码。

格式互转：调用轻量级文本模型，实现TeX与MD格式的精准语义转换。

设计权衡：暂不开发图片上传识别（建议直接拍照使用现成AI工具），但支持粘贴文本进行解析。

安全与展望：当前API Key经服务端中转，建议自行改为前端直连或本地部署以保障安全。未来视空闲情况，计划封装为插件或App。

具体情况和内容见更新日志

希望你用得开心，真拿这个东西改造出了什么别的好玩的，记得给我也看看（

##实际使用测试

*写的不太好的字的识别
![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/mmexport1766463954386.jpg) 

*比较复杂的可视化（伪转动 boost）
![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/mmexport1766463907871.jpg)

*过于复杂的公式/理论的可视化可能不太好，或者根本就没什么可视化的，这就不能强求AI了
![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/mmexport1766463962125.jpg)

*使用AI的好处，连函数图像也可以识别，现场就可以生成能用的tex代码（只不过KaTeX不支持实时渲染，得下载之后用XeLaTeX等编译）
![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/IMG_20251223_122625.jpg)
![](https://github.com/Zhen-WushuiLingchun/principia/blob/main/images/IMG_20251223_122710.jpg)

