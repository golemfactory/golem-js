import os
import json


def update_globals(file_path, node_name):
    try:
        with open(file_path, 'r+') as f:
            data = json.load(f)
            data['node_name'] = node_name
            f.seek(0)
            print(data)
            json.dumps(data, f)
            f.truncate()
            print(f"Provider node name configured to {node_name}")
    except Exception as e:
        print(f"Error occurred: {str(e)}")


update_globals(os.path.expanduser(
    '/root/.local/share/ya-provider/globals.json'), os.environ.get('NODE_NAME'))
