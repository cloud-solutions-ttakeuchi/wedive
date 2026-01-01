import functions_framework
import json
from sudachipy import dictionary
from sudachipy import tokenizer

# Sudachi の初期化（グローバルで行うことでウォームスタート時に再利用）
tokenizer_obj = dictionary.Dictionary().create()
mode = tokenizer.Tokenizer.SplitMode.C

def to_kana(text):
    if not text:
        return ""
    # カタカナ変換ロジック
    # Sudachiの形態素解析結果から読み（reading）を取得
    tokens = tokenizer_obj.tokenize(text, mode)
    kana_list = []
    for m in tokens:
        # 読みがある場合はそれを使い、無い場合は自身（記号等）を使う
        reading = m.reading_form()
        kana_list.append(reading if reading else m.surface())
    return "".join(kana_list)

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
