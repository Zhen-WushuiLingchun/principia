import os
import sys
import json
import time
import uuid
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import requests
import traceback

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ocr_processing.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('ocr_system')

# In-memory task progress tracking
task_progress = {}

# 性能监控数据
performance_metrics = {
    'total_requests': 0,
    'successful_requests': 0,
    'failed_requests': 0,
    'total_processing_time': 0,
    'average_processing_time': 0,
    'error_counts': {}
}

# Configuration
PORT = 8000

# Error handling configuration
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# Initialize Flask App
app = Flask(__name__, static_folder='principia')
CORS(app)  # Enable CORS for all routes

# Error handling utilities
def retry_on_failure(max_retries=MAX_RETRIES, delay=RETRY_DELAY):
    """Decorator to retry function calls on transient failures"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except (requests.RequestException, OpenAI.Error) as e:
                    retries += 1
                    if retries >= max_retries:
                        raise
                    print(f"Retrying after error: {str(e)} (Attempt {retries}/{max_retries})")
                    time.sleep(delay)
        return wrapper
    return decorator

def get_user_friendly_error_message(error):
    """Convert technical errors into user-friendly messages"""
    error_str = str(error)
    
    # Common error patterns and their user-friendly counterparts
    error_mappings = {
        "API key not found": "API密钥未配置，请在设置中配置API密钥",
        "Invalid API key": "API密钥无效，请检查并更新API密钥",
        "Rate limit exceeded": "API调用频率超过限制，请稍后再试",
        "Network error": "网络连接错误，请检查您的网络连接",
        "Request timeout": "请求超时，请稍后再试",
        "401 Unauthorized": "API认证失败，请检查API密钥是否正确",
        "403 Forbidden": "API访问被拒绝，请检查API密钥权限",
        "404 Not Found": "请求的资源不存在",
        "500 Internal Server Error": "服务器内部错误，请稍后再试",
    }
    
    # Check for specific error patterns
    for pattern, message in error_mappings.items():
        if pattern in error_str:
            return message
    
    # Default error message
    return "处理请求时发生错误，请稍后再试"

def create_error_response(error, status_code=500):
    """Create a structured error response"""
    # Get user-friendly message
    user_message = get_user_friendly_error_message(error)
    
    # Get detailed error information for logging
    detailed_error = {
        "message": str(error),
        "traceback": traceback.format_exc()
    }
    
    # Log the detailed error
    print(f"Error details: {json.dumps(detailed_error, indent=2)}")
    
    # Return user-friendly error response
    return jsonify({
        "error": user_message,
        "error_code": status_code
    }), status_code

@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        context = data.get('context', '')
        full_context = data.get('fullContext', '')
        reasoning_config = data.get('reasoningConfig', {})
        vision_config = data.get('visionConfig', {})
        
        if not context:
            return jsonify({'error': '未提供上下文信息', 'error_code': 400}), 400

        # Determine Client and Model for Reasoning (Explanation)
        if reasoning_config and reasoning_config.get('apiKey'):
            # print(f"Using custom reasoning config: {reasoning_config.get('model')}") # Removed for security
            current_reasoning_client = OpenAI(
                api_key=reasoning_config.get('apiKey'),
                base_url=reasoning_config.get('baseUrl')
            )
            current_reasoning_model = reasoning_config.get('model')
        else:
            return jsonify({'error': '推理API配置缺失，请在设置中配置API密钥', 'error_code': 401}), 401
            
        # 1. Get Explanation
        print(f"Requesting explanation...")
        explanation_prompt = f"""
        You are an expert physics and mathematics tutor.
        
        Target Formula/Concept: "{context}"
        
        Full Document Context:
        "{full_context}"
        
        Task:
        1. Analyze the "Target Formula/Concept" within the context of the "Full Document Context".
        2. Provide a brief, clear, and insightful explanation. Focus on the "why" and "how".
        3. **LANGUAGE DETECTION**: Detect the language used in the "Full Document Context" (e.g., English, Chinese, French). 
        4. **OUTPUT LANGUAGE**: Your explanation MUST be in the SAME language as the "Full Document Context". If the context is mixed, prioritize the language of the descriptive text surrounding the formula.
        5. **MATH RENDERING**: If your explanation includes mathematical formulas, YOU MUST wrap them in standard LaTeX math delimiters:
           - Use $...$ for inline math (e.g., $E=mc^2$).
           - Use $$...$$ for display math.
           - DO NOT use markdown code blocks for math.
        6. Return ONLY the explanation text.
        """
        
        @retry_on_failure()
        def get_explanation():
            return current_reasoning_client.chat.completions.create(
                model=current_reasoning_model,
                messages=[
                    {"role": "system", "content": "You are a helpful physics tutor."},
                    {"role": "user", "content": explanation_prompt}
                ]
            )
        
        explanation_response = get_explanation()
        explanation = explanation_response.choices[0].message.content.strip()

        # 2. Get Visualization Code
        # Use vision_config (Multimodal) for visualization if available, as it requires strong coding/spatial capabilities.
        if vision_config and vision_config.get('apiKey'):
            # print(f"Using custom vision config for visualization: {vision_config.get('model')}") # Removed for security
            viz_client = OpenAI(
                api_key=vision_config.get('apiKey'),
                base_url=vision_config.get('baseUrl')
            )
            viz_model = vision_config.get('model')
        else:
            return jsonify({'error': '视觉API配置缺失，请在设置中配置API密钥', 'error_code': 401}), 401

        print(f"Requesting visualization...")
        viz_prompt = f"""
        You are an expert frontend developer and physics simulation specialist.
        
        Task: Create a **Dynamic, Interactive Physics Simulation** using HTML5 Canvas and JavaScript.
        
        **Source Material**:
        1. **Target Concept**: "{context}"
        2. **Physics Logic (Source of Truth for Formulas)**: 
           "{explanation}"
        3. **Scenario Context (Source of Truth for Environment/Parameters)**: 
           "{full_context}"
        
        **Implementation Strategy**:
        1. **Analyze the Physics**: Use the "Physics Logic" to determine the governing equations (kinematics, dynamics, wave equations, etc.).
        2. **Extract Parameters**: Scan the "Scenario Context" for specific values (e.g., "velocity of 20m/s", "angle of 45 degrees", "mass of 5kg"). 
           - **CRITICAL**: If the context mentions specific numbers, YOU MUST set them as the initial values for your simulation variables.
        3. **Design the Visuals**: Use the "Scenario Context" to decide what to draw (e.g., if it mentions a "cliff", draw a cliff; if "spring", draw a spring).
        
        CRITICAL REQUIREMENTS:
        1. **Relevance**: The simulation MUST directly visualize the specific physics concept described.
           - Use the context to understand specific scenarios.
           - If it's a projectile, show a projectile.
           - If it's a wave, show a wave.
           - If it's a field, show vector fields or particles in a field.
           - **DO NOT default to a pendulum or spring unless the concept specifically calls for it.**
        
        2. **Physics Accuracy**: Use `requestAnimationFrame` to animate the system based on real physics equations derived from the concept.
        
        3. **Interactivity**: Include HTML range sliders to adjust key parameters relevant to the specific model (e.g., initial velocity, charge, frequency, mass).
        
        4. **Style**: 
          - Background: Dark (`#000` or `#111`).
          - Text: Light (`#eee`).
          - Controls: Minimalist, styled for dark mode.
        
        5. **Language Adaptation**:
          - **LANGUAGE DETECTION**: Detect the language used in the "Full Document Context" (e.g., English, Chinese, French).
          - **OUTPUT LANGUAGE**: Any text displayed in the simulation (labels, titles, slider names, instructions) MUST be in the SAME language as the "Full Document Context". If the context is mixed, prioritize the language of the descriptive text surrounding the formula.

        6. **Output Format**:
          - Return **ONLY** the HTML snippet containing the container `div`, controls, and the `script` tag.
          - Do NOT include `<html>`, `<head>`, `<body>`, or markdown code fences.
          - The root container must have `width: 100%; height: 300px;`.
        """

        @retry_on_failure()
        def get_visualization():
            return viz_client.chat.completions.create(
                model=viz_model,
                messages=[
                    {"role": "system", "content": "You are a code generator. Output raw HTML/JS only."},
                    {"role": "user", "content": viz_prompt}
                ]
            )
        
        viz_response = get_visualization()
        visualization = viz_response.choices[0].message.content.strip()
        
        # Cleanup markdown if present
        if visualization.startswith("```html"):
            visualization = visualization[7:]
        if visualization.startswith("```"):
            visualization = visualization[3:]
        if visualization.endswith("```"):
            visualization = visualization[:-3]

        return jsonify({
            "explanation": explanation,
            "visualization": visualization
        })

    except Exception as e:
        return create_error_response(e)

@app.route('/api/convert', methods=['POST'])
def convert_format():
    try:
        data = request.json
        content = data.get('content', '')
        target_format = data.get('targetFormat', 'tex') # 'tex' or 'md'
        reasoning_config = data.get('reasoningConfig', {})
        
        if not content:
            return jsonify({'error': '未提供内容', 'error_code': 400}), 400

        # Determine Client
        if reasoning_config and reasoning_config.get('apiKey'):
            # print(f"Using custom reasoning config for conversion: {reasoning_config.get('model')}") # Removed for security
            client = OpenAI(
                api_key=reasoning_config.get('apiKey'),
                base_url=reasoning_config.get('baseUrl')
            )
            model = reasoning_config.get('model')
        else:
             return jsonify({'error': '推理API配置缺失，请在设置中配置API密钥', 'error_code': 401}), 401

        print(f"Requesting format conversion to {target_format}...")
        
        if target_format == 'tex':
            prompt = f"""
            Convert the following Markdown/LaTeX mixed content into a pure, compile-ready LaTeX document body.
            
            Rules:
            1. Convert Markdown headers (#, ##) to LaTeX sections (\section, \subsection).
            2. Convert Markdown lists (- , 1.) to LaTeX lists (itemize, enumerate).
            3. Convert Markdown bold/italic to LaTeX (\textbf, \textit).
            4. **COLOR PRESERVATION**:
               - Keep `\textcolor{{color}}{{text}}` as is.
               - Convert `<font color="color">text</font>` to `\textcolor{{color}}{{text}}` (if present).
               - Convert `<span style="color: color">text</span>` to `\textcolor{{color}}{{text}}` (if present).
            5. Keep existing LaTeX math ($...$, $$...$$) unchanged.
            6. Return ONLY the converted LaTeX body code. Do NOT wrap in \documentclass.
            7. Do not include markdown code fences.
            
            Content:
            "{content}"
            """
        else: # md
            prompt = f"""
            Convert the following LaTeX content into clean Markdown.
            
            Rules:
            1. **COLOR PRESERVATION (HIGHEST PRIORITY)**: 
               - **KEEP** `\textcolor{{color}}{{text}}` commands AS IS. 
               - **DO NOT** convert color to bold (`**`) or italic (`*`).
               - **DO NOT** convert color to HTML.
               - Convert `{{\color{{color}} text}}` to `\textcolor{{color}}{{text}}`.
            2. Convert LaTeX sections (\section, \subsection) to Markdown headers (#, ##).
            3. Convert LaTeX lists to Markdown lists.
            4. Convert LaTeX text formatting (\textbf, \textit) to Markdown (**...**, *...*).
               - Only convert `\textbf` and `\textit`. DO NOT touch `\textcolor`.
            5. Keep LaTeX math ($...$, $$...$$) unchanged.
            6. Return ONLY the converted Markdown content.
            7. Do not include markdown code fences.
            
            Content:
            "{content}"
            """

        @retry_on_failure()
        def get_conversion():
            return client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a document format converter."},
                    {"role": "user", "content": prompt}
                ]
            )
        
        response = get_conversion()
        converted = response.choices[0].message.content.strip()
        
        # Cleanup
        if converted.startswith("```latex") or converted.startswith("```markdown"):
            converted = converted.split('\n', 1)[1]
        if converted.startswith("```"):
            converted = converted[3:]
        if converted.endswith("```"):
            converted = converted[:-3]

        return jsonify({'converted': converted.strip()})

    except Exception as e:
        return create_error_response(e)

def post_process_ocr_result(latex_code):
    """
    Post-process OCR result to fix common errors and ensure LaTeX syntax correctness
    """
    # Fix common symbol errors
    symbol_fixes = {
        'l': 'l',  # Ensure lowercase l is preserved
        '1': '1',  # Ensure number 1 is preserved
        'O': 'O',  # Ensure uppercase O is preserved
        '0': '0',  # Ensure number 0 is preserved
        'S': 'S',  # Ensure uppercase S is preserved
        '5': '5',  # Ensure number 5 is preserved
        'B': 'B',  # Ensure uppercase B is preserved
        '8': '8',  # Ensure number 8 is preserved
        'g': 'g',  # Ensure lowercase g is preserved
        'q': 'q',  # Ensure lowercase q is preserved
        '9': '9',  # Ensure number 9 is preserved
        '6': '6',  # Ensure number 6 is preserved
        'Z': 'Z',  # Ensure uppercase Z is preserved
        '2': '2',  # Ensure number 2 is preserved
        '7': '7',  # Ensure number 7 is preserved
        '4': '4',  # Ensure number 4 is preserved
        '3': '3',  # Ensure number 3 is preserved
    }
    
    # Fix common LaTeX command errors
    command_fixes = {
        '\\frac': '\\frac',
        '\\sqrt': '\\sqrt',
        '\\sin': '\\sin',
        '\\cos': '\\cos',
        '\\tan': '\\tan',
        '\\log': '\\log',
        '\\ln': '\\ln',
        '\\sum': '\\sum',
        '\\int': '\\int',
        '\\lim': '\\lim',
        '\\infty': '\\infty',
        '\\pi': '\\pi',
        '\\theta': '\\theta',
        '\\alpha': '\\alpha',
        '\\beta': '\\beta',
        '\\gamma': '\\gamma',
        '\\delta': '\\delta',
        '\\epsilon': '\\epsilon',
        '\\varepsilon': '\\varepsilon',
        '\\zeta': '\\zeta',
        '\\eta': '\\eta',
        '\\theta': '\\theta',
        '\\vartheta': '\\vartheta',
        '\\iota': '\\iota',
        '\\kappa': '\\kappa',
        '\\lambda': '\\lambda',
        '\\mu': '\\mu',
        '\\nu': '\\nu',
        '\\xi': '\\xi',
        '\\pi': '\\pi',
        '\\rho': '\\rho',
        '\\sigma': '\\sigma',
        '\\tau': '\\tau',
        '\\upsilon': '\\upsilon',
        '\\phi': '\\phi',
        '\\varphi': '\\varphi',
        '\\chi': '\\chi',
        '\\psi': '\\psi',
        '\\omega': '\\omega',
        '\\textcolor': '\\textcolor',
    }
    
    # Fix common format issues
    format_fixes = {
        '$$': '$$',  # Ensure display math delimiters are preserved
        '$': '$',  # Ensure inline math delimiters are preserved
        '\\(' : '\\(',  # Ensure math mode delimiters are preserved
        '\\)' : '\\)',  # Ensure math mode delimiters are preserved
        '\\[' : '\\[',  # Ensure display math delimiters are preserved
        '\\]' : '\\]',  # Ensure display math delimiters are preserved
    }
    
    # Apply symbol fixes
    for wrong, right in symbol_fixes.items():
        latex_code = latex_code.replace(wrong, right)
    
    # Apply command fixes
    for wrong, right in command_fixes.items():
        latex_code = latex_code.replace(wrong, right)
    
    # Apply format fixes
    for wrong, right in format_fixes.items():
        latex_code = latex_code.replace(wrong, right)
    
    # Fix missing braces in commands
    latex_code = fix_missing_braces(latex_code)
    
    # Fix missing math mode delimiters
    latex_code = fix_math_mode_delimiters(latex_code)
    
    # Fix color command issues
    latex_code = fix_color_commands(latex_code)
    
    return latex_code


def fix_missing_braces(latex_code):
    """
    Fix missing braces in LaTeX commands
    """
    # This is a simple implementation that fixes common cases
    # More complex cases would require a proper parser
    
    # Fix \frac without braces
    import re
    latex_code = re.sub(r'\\frac\s*([^\\s{}]+)\s*([^\\s{}]+)', r'\\frac{\1}{\2}', latex_code)
    
    # Fix \sqrt without braces
    latex_code = re.sub(r'\\sqrt\s*([^\\s{}]+)', r'\\sqrt{\1}', latex_code)
    
    return latex_code


def fix_math_mode_delimiters(latex_code):
    """
    Fix missing math mode delimiters
    """
    # This is a simple implementation that fixes common cases
    # More complex cases would require a proper parser
    
    # Check for math commands outside of math mode
    math_commands = ['\\frac', '\\sqrt', '\\sin', '\\cos', '\\tan', '\\log', '\\ln', '\\sum', '\\int', '\\lim', '\\infty', '\\pi']
    
    for cmd in math_commands:
        # Check if command is present outside of math mode
        import re
        pattern = r'(?<!\$)(?<!\\()' + re.escape(cmd) + r'(?!\$)(?!\\))'
        matches = re.findall(pattern, latex_code)
        
        if matches:
            # This is a simplistic approach - in a real implementation, we would need to
            # find the boundaries of the math expression and wrap it properly
            pass
    
    return latex_code


def fix_color_commands(latex_code):
    """
    Fix color command issues in LaTeX code
    """
    import re
    
    # Valid LaTeX color names
    valid_colors = {'red', 'blue', 'green', 'orange', 'purple', 'black', 'white', 'gray', 'grey', 'yellow', 'cyan', 'magenta'}
    
    # Fix 	extcolor commands with missing braces
    # Match \textcolor{color}text -> \textcolor{color}{text}
    latex_code = re.sub(r'\\textcolor\{([^}]+)\}([^\\{]+)(?=\\textcolor|$)', r'\\textcolor{\1}{\2}', latex_code)
    
    # Fix 	extcolor commands with incorrect color names
    def replace_invalid_color(match):
        color = match.group(1)
        if color.lower() not in valid_colors:
            # Map common color variations to valid names
            color_map = {
                'lightblue': 'blue',
                'darkblue': 'blue',
                'lightred': 'red',
                'darkred': 'red',
                'lightgreen': 'green',
                'darkgreen': 'green',
                'lightorange': 'orange',
                'darkorange': 'orange',
                'lightpurple': 'purple',
                'darkpurple': 'purple',
                'grey': 'gray'
            }
            return f'\\textcolor{{{color_map.get(color.lower(), "red")}}}{{{match.group(2)}}}'
        return match.group(0)
    
    latex_code = re.sub(r'\\textcolor\{([^}]+)\}\{([^}]+)\}', replace_invalid_color, latex_code)
    
    # Ensure math mode within color commands is properly formatted
    # Match \textcolor{color}{$math$} -> ensure math mode is preserved
    latex_code = re.sub(r'\\textcolor\{([^}]+)\}\{\$(.+?)\$\}', r'\\textcolor{\1}{\$\2\$}', latex_code)
    
    return latex_code


def preprocess_image(image_data):
    """
    预处理图片数据，提高 OCR 识别成功率
    """
    # 这里可以添加图片预处理逻辑，例如：
    # 1. 调整图片大小
    # 2. 增强对比度
    # 3. 降噪处理
    # 4. 边缘检测
    # 目前返回原始数据，后续可以扩展
    return image_data

@app.route('/api/ocr', methods=['POST'])
def ocr():
    # 记录请求开始时间
    start_time = time.time()
    # 增加总请求计数
    performance_metrics['total_requests'] += 1
    
    try:
        data = request.json
        image_data = data.get('image', '') # Expecting base64 string
        vision_config = data.get('visionConfig', {})
        previous_context = data.get('previousContext', '')
        next_context = data.get('nextContext', '')
        
        if not image_data:
            performance_metrics['failed_requests'] += 1
            error_response = {'error': '未提供图片', 'error_code': 400, 'status': 'error', 'status_message': '参数错误'}
            logger.warning(f"OCR 请求失败: 未提供图片")
            return jsonify(error_response), 400

        # Generate task ID for progress tracking
        task_id = str(uuid.uuid4())
        # Initialize progress with detailed status
        task_progress[task_id] = {
            'status': 'processing',
            'progress': 0,
            'result': None,
            'status_message': '正在初始化 OCR 处理...',
            'timestamp': time.time(),
            'start_time': start_time
        }
        
        logger.info(f"开始 OCR 处理任务: {task_id}")

        # Determine Client and Model for Vision
        if vision_config and vision_config.get('apiKey'):
            # print(f"Using custom vision config: {vision_config.get('model')}") # Removed for security
            current_vision_client = OpenAI(
                api_key=vision_config.get('apiKey'),
                base_url=vision_config.get('baseUrl')
            )
            current_vision_model = vision_config.get('model')
            logger.info(f"使用模型: {current_vision_model} 进行 OCR 处理")
        else:
            task_progress[task_id]['status'] = 'error'
            task_progress[task_id]['error'] = '视觉API配置缺失，请在设置中配置API密钥'
            task_progress[task_id]['status_message'] = 'API 配置错误'
            performance_metrics['failed_requests'] += 1
            error_response = {'error': '视觉API配置缺失，请在设置中配置API密钥', 'error_code': 401, 'status': 'error', 'status_message': 'API 配置错误'}
            logger.error(f"OCR 请求失败: 视觉API配置缺失")
            return jsonify(error_response), 401

        # Update progress: Configuration complete
        task_progress[task_id]['progress'] = 10
        task_progress[task_id]['status_message'] = '配置完成，准备处理图片...'
        task_progress[task_id]['timestamp'] = time.time()
        logger.info(f"任务 {task_id}: 配置完成，准备处理图片")

        # 图片预处理
        logger.info(f"任务 {task_id}: 开始预处理图片")
        task_progress[task_id]['status_message'] = '正在预处理图片...'
        task_progress[task_id]['timestamp'] = time.time()
        image_data = preprocess_image(image_data)
        
        # Update progress: Image preprocessed
        task_progress[task_id]['progress'] = 20
        task_progress[task_id]['status_message'] = '图片预处理完成，准备构建识别提示...'
        task_progress[task_id]['timestamp'] = time.time()
        logger.info(f"任务 {task_id}: 图片预处理完成")

        # Construct Contextual Prompt
        system_prompt = """Transcribe this handwritten note into valid XeLaTeX code.

RULES:
1. Return ONLY the body content (formulas, text, etc.).
2. Do NOT include \documentclass, \begin{document}, \maketitle, or \end{document}.
3. Assume standard packages (amsmath, amssymb, geometry, xcolor) are already loaded.
4. Use standard LaTeX math mode ($...$ for inline, $$...$$ for display).
5. Correct any obvious physical or mathematical errors based on context.
6. Return ONLY the LaTeX code, no markdown fencing.
7. **COLOR DETECTION (ENHANCED)**:
   - **Color Identification**: Carefully analyze the color of each handwritten stroke, considering both hue and intensity.
   - **Color Categories**: Recognize the following colors with high accuracy:
     * Red (\textcolor{red}{...})
     * Blue (\textcolor{blue}{...})
     * Green (\textcolor{green}{...})
     * Orange (\textcolor{orange}{...})
     * Purple (\textcolor{purple}{...})
     * Black (no color command)
     * Gray (no color command)
     * White (no color command)
   - **Color Consistency**: Apply color commands consistently to entire words, phrases, or formulas written in the same color.
   - **Mixed Colors**: If different parts of the same formula or text are in different colors, apply color commands to each part separately.
   - **Background Consideration**: Consider the background color when determining the text color (e.g., light text on dark background).
   - **Color Variants**: For color variants (e.g., light blue, dark red), use the closest standard color name that best represents the shade.
"""

        
        if previous_context:
            system_prompt += f"\n\nPREVIOUS CONTEXT (The text immediately preceding this image):\n...{previous_context}\n\nINSTRUCTION: Ensure your transcription flows naturally from this previous context."
            
        if next_context:
            system_prompt += f"\n\nNEXT CONTEXT (The text immediately following this image):\n{next_context}...\n\nINSTRUCTION: Ensure your transcription connects smoothly to this next context."

        # Update progress: Prompt constructed
        task_progress[task_id]['progress'] = 40
        task_progress[task_id]['status_message'] = '识别提示构建完成，正在请求 OCR 服务...'
        task_progress[task_id]['timestamp'] = time.time()
        logger.info(f"任务 {task_id}: 识别提示构建完成")

        # Use Gemini/Custom for Vision/OCR as it has strong multimodal capabilities
        logger.info(f"任务 {task_id}: 请求 OCR 服务")
        
        @retry_on_failure(max_retries=5, delay=3)  # 增加重试次数和延迟
        def get_ocr():
            return current_vision_client.chat.completions.create(
                model=current_vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": system_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_data
                                }
                            }
                        ],
                    }
                ],
                max_tokens=2000,
                temperature=0.1,  # 降低温度以提高准确性
                timeout=30,  # 增加超时时间
                top_p=0.95  # 优化 top_p 参数
            )
        
        # Update progress: API request sent
        task_progress[task_id]['progress'] = 60
        task_progress[task_id]['status_message'] = '正在等待 OCR 服务响应...'
        task_progress[task_id]['timestamp'] = time.time()
        response = get_ocr()

        # Update progress: API response received
        task_progress[task_id]['progress'] = 80
        task_progress[task_id]['status_message'] = 'OCR 服务响应收到，正在处理结果...'
        task_progress[task_id]['timestamp'] = time.time()
        logger.info(f"任务 {task_id}: OCR 服务响应收到")

        latex_code = response.choices[0].message.content.strip()
        # Remove markdown code blocks if present
        if latex_code.startswith("```latex"):
            latex_code = latex_code[8:]
        if latex_code.startswith("```"):
            latex_code = latex_code[3:]
        if latex_code.endswith("```"):
            latex_code = latex_code[:-3]
        
        # Post-process OCR result to fix common errors and ensure LaTeX syntax correctness
        task_progress[task_id]['status_message'] = '正在后处理 OCR 结果...'
        task_progress[task_id]['timestamp'] = time.time()
        logger.info(f"任务 {task_id}: 正在后处理 OCR 结果")
        latex_code = post_process_ocr_result(latex_code)
        
        # 计算处理时间
        processing_time = time.time() - start_time
        
        # Update progress: Processing complete
        task_progress[task_id]['progress'] = 100
        task_progress[task_id]['status'] = 'completed'
        task_progress[task_id]['status_message'] = 'OCR 处理完成'
        task_progress[task_id]['result'] = latex_code.strip()
        task_progress[task_id]['timestamp'] = time.time()
        task_progress[task_id]['processing_time'] = processing_time
        
        # 更新性能指标
        performance_metrics['successful_requests'] += 1
        performance_metrics['total_processing_time'] += processing_time
        performance_metrics['average_processing_time'] = performance_metrics['total_processing_time'] / performance_metrics['successful_requests']
        
        logger.info(f"任务 {task_id}: OCR 处理完成，耗时: {processing_time:.2f} 秒")
            
        return jsonify({'task_id': task_id, 'latex': latex_code.strip(), 'status': 'completed', 'status_message': 'OCR 处理完成', 'processing_time': processing_time})

    except Exception as e:
        error_message = str(e)
        processing_time = time.time() - start_time
        
        # 更新性能指标
        performance_metrics['failed_requests'] += 1
        
        # 记录错误类型
        error_type = type(e).__name__
        if error_type not in performance_metrics['error_counts']:
            performance_metrics['error_counts'][error_type] = 0
        performance_metrics['error_counts'][error_type] += 1
        
        logger.error(f"OCR 处理失败: {error_message}, 耗时: {processing_time:.2f} 秒", exc_info=True)
        
        # 增强错误处理和诊断
        if 'task_id' in locals():
            task_progress[task_id]['status'] = 'error'
            task_progress[task_id]['error'] = error_message
            task_progress[task_id]['status_message'] = '处理失败'
            task_progress[task_id]['timestamp'] = time.time()
            task_progress[task_id]['processing_time'] = processing_time
        
        # 提供更详细的错误信息和解决建议
        if "API key not found" in error_message or "Invalid API key" in error_message:
            error_response = {'error': 'API密钥无效或未配置，请在设置中检查API密钥', 'error_code': 401, 'status': 'error', 'status_message': 'API 配置错误', 'processing_time': processing_time}
            return jsonify(error_response), 401
        elif "Rate limit exceeded" in error_message:
            error_response = {'error': 'API调用频率超过限制，请稍后再试', 'error_code': 429, 'status': 'error', 'status_message': 'API 频率限制', 'processing_time': processing_time}
            return jsonify(error_response), 429
        elif "Network error" in error_message or "Request timeout" in error_message:
            error_response = {'error': '网络连接错误或请求超时，请检查网络连接后重试', 'error_code': 503, 'status': 'error', 'status_message': '网络错误', 'processing_time': processing_time}
            return jsonify(error_response), 503
        elif "401 Unauthorized" in error_message:
            error_response = {'error': 'API认证失败，请检查API密钥是否正确', 'error_code': 401, 'status': 'error', 'status_message': '认证失败', 'processing_time': processing_time}
            return jsonify(error_response), 401
        elif "403 Forbidden" in error_message:
            error_response = {'error': 'API访问被拒绝，请检查API密钥权限', 'error_code': 403, 'status': 'error', 'status_message': '访问拒绝', 'processing_time': processing_time}
            return jsonify(error_response), 403
        elif "404 Not Found" in error_message:
            error_response = {'error': '请求的资源不存在', 'error_code': 404, 'status': 'error', 'status_message': '资源不存在', 'processing_time': processing_time}
            return jsonify(error_response), 404
        elif "500 Internal Server Error" in error_message:
            error_response = {'error': '服务器内部错误，请稍后再试', 'error_code': 500, 'status': 'error', 'status_message': '服务器错误', 'processing_time': processing_time}
            return jsonify(error_response), 500
        else:
            # 针对 "Smart recognition failed" 错误的特殊处理
            if "Smart recognition failed" in error_message or "OCR Failed" in error_message:
                error_response = {'error': '智能识别失败，请尝试以下解决方法：1. 确保图片清晰 2. 确保光线充足 3. 确保手写内容清晰可辨 4. 尝试调整图片大小', 'error_code': 400, 'status': 'error', 'status_message': '识别失败', 'processing_time': processing_time}
                return jsonify(error_response), 400
            error_response = create_error_response(e)
            # 确保错误响应包含状态信息
            if isinstance(error_response, tuple):
                error_data = error_response[0].json
                error_data['status'] = 'error'
                error_data['status_message'] = '处理失败'
                error_data['processing_time'] = processing_time
                return jsonify(error_data), error_response[1]
            return error_response

@app.route('/api/ocr/progress/<task_id>', methods=['GET'])
def ocr_progress(task_id):
    """Get the progress of an OCR task"""
    if task_id in task_progress:
        return jsonify(task_progress[task_id])
    else:
        return jsonify({'error': 'Task not found', 'error_code': 404}), 404



# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'dev.html')

if __name__ == "__main__":
    print(f"--------------------------------------------------")
    print(f"The Principia Backend Running on Port {PORT}")
    print(f"--------------------------------------------------")
    app.run(port=PORT, debug=True, use_reloader=False)