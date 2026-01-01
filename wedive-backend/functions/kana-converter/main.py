import functions_framework
import json
from sudachipy import dictionary
from sudachipy import tokenizer

# Sudachi の初期化（グローバルで行うことでウォームスタート時に再利用）
tokenizer_obj = dictionary.Dictionary().create()
mode = tokenizer.Tokenizer.SplitMode.C

import re

def to_kana(text):
    if not text:
        return ""

    # 英数字（全角含む）、漢字、ひらがな、カタカナの塊を単語として認識し、それ以外（記号・空白）を区切りとして保持
    # () で囲むことで、分割後のリストに区切り文字も含まれる
    word_pattern = r'[a-zA-Z0-9\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]'
    parts = re.split(f'({word_pattern}+)', text)

    kana_parts = []
    for part in parts:
        if not part:
            continue

        # 単語の部分（正規表現にマッチするもの）のみ Sudachi で解析
        if re.match(f'^{word_pattern}+$', part):
            tokens = tokenizer_obj.tokenize(part, mode)
            for m in tokens:
                reading = m.reading_form()
                # 読みがあれば採用、ただし万が一「キゴウ」系が出たら表面文字を採用
                if reading and "キゴウ" not in reading:
                    kana_parts.append(reading)
                else:
                    kana_parts.append(m.surface())
        else:
            # 記号や空白の塊はそのまま通す
            kana_parts.append(part)

    return "".join(kana_parts)

@functions_framework.http
def fn_to_kana(request):
    """
    POST {"items": [{"id": "...", "name": "..."}, ...]}
    Returns {"results": [{"id": "...", "name_kana": "..."}, ...]}
    """
    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    request_json = request.get_json(silent=True)
    if not request_json or "items" not in request_json:
        return ({"error": "Invalid request. 'items' list required."}, 400)

    items = request_json.get("items", [])
    results = []

    for item in items:
        processed_item = {}
        for k, v in item.items():
            processed_item[k] = v
            if k != "id" and isinstance(v, str) and v.strip():
                processed_item[f'{k}_kana'] = to_kana(v)
        results.append(processed_item)
    return ({"results": results}, 200, {'Content-Type': 'application/json'})
