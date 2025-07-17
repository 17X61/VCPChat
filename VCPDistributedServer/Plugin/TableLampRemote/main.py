import sys
import json
import subprocess
import os

# --- 配置 ---
DEVICE_NAME = "米家台灯Pro"

# --- 辅助函数 ---

def run_command(command):
    """执行一个 shell 命令并返回其输出"""
    try:
        # 在 Windows 上，需要设置 shell=True 来正确处理带空格和引号的命令
        # 使用 'utf-8' 编码来解码输出，避免中文乱码
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            check=True  # 如果命令返回非零退出码，则抛出 CalledProcessError
        )
        return {"success": True, "output": result.stdout.strip()}
    except subprocess.CalledProcessError as e:
        error_message = f"命令执行失败: {e.cmd}\n退出码: {e.returncode}\n输出: {e.stdout}\n错误: {e.stderr}"
        return {"success": False, "output": error_message}
    except Exception as e:
        return {"success": False, "output": f"执行命令时发生未知错误: {str(e)}"}

def send_response(status, result):
    """将最终结果以JSON格式打印到标准输出"""
    response = {"status": status, "result": result}
    print(json.dumps(response, ensure_ascii=False))
    sys.exit(0)

# --- 命令处理函数 ---

def handle_get_status():
    """处理获取台灯状态的请求"""
    properties_to_get = {
        "on": "开关状态",
        "brightness": "亮度",
        "color-temperature": "色温"
    }
    results = []
    
    for prop, desc_zh in properties_to_get.items():
        command = f'python -m mijiaAPI get --dev_name "{DEVICE_NAME}" --prop_name "{prop}"'
        res = run_command(command)
        if res["success"]:
            # mijiaAPI 的输出格式为 "设备名 的 属性名 值为 值"
            # 我们只需要最后的值
            value = res["output"].split("值为")[-1].strip()
            results.append(f"{desc_zh}为 {value}")
        else:
            # 如果任何一个属性获取失败，立即返回错误
            send_response("error", f"获取属性 '{prop}' 失败: {res['output']}")
            return

    final_report = f"台灯当前状态：{ '，'.join(results) }。"
    send_response("success", final_report)

def handle_lamp_control(args):
    """处理控制台灯的请求，支持批量操作"""
    
    # 将AI可能使用的参数名映射到mijiaAPI的属性名
    prop_map = {
        "power": "on",
        "brightness": "brightness",
        "color_temperature": "color-temperature"
    }
    
    commands_to_run = []
    for arg_key, prop_name in prop_map.items():
        if arg_key in args:
            value = args[arg_key]
            cmd = f'python -m mijiaAPI set --dev_name "{DEVICE_NAME}" --prop_name "{prop_name}" --value "{value}"'
            commands_to_run.append(cmd)

    if not commands_to_run:
        send_response("error", "未提供任何有效的控制参数（power, brightness, color_temperature）。")
        return

    results_summary = []
    for command in commands_to_run:
        res = run_command(command)
        if res["success"]:
            results_summary.append(res["output"])
        else:
            # 如果有任何一个命令失败，则将错误信息加入汇总
            results_summary.append(f"命令执行失败: {res['output']}")
    
    final_report = "批处理执行完成：\n" + "\n".join(results_summary)
    send_response("success", final_report)


# --- 主逻辑 ---

def main():
    try:
        # 1. 从 stdin 读取输入
        request_str = sys.stdin.readline().strip()
        if not request_str:
            send_response("error", "未从 stdin 接收到任何输入。")
            return
            
        # 2. 解析 JSON
        request_data = json.loads(request_str)
        command = request_data.get("command")

        # 3. 根据 command 调用不同的处理函数
        if command == "GetLampStatus":
            handle_get_status()
        elif command == "LampControl":
            # 将除了 command 之外的所有参数传递给处理函数
            params = {k: v for k, v in request_data.items() if k != 'command'}
            handle_lamp_control(params)
        else:
            send_response("error", f"未知的 command: '{command}'")

    except json.JSONDecodeError:
        send_response("error", "无法解析来自 stdin 的 JSON 输入。")
    except Exception as e:
        send_response("error", f"插件执行时发生意外错误: {str(e)}")

if __name__ == "__main__":
    main()