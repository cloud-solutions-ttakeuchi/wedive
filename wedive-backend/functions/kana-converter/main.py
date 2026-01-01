import functions_framework
from flask import jsonify
from sudachipy import dictionary
from sudachipy import tokenizer

# グローバルスコープで辞書をロード（ウォームスタート時の再利用）
tokenizer_obj = None

def get_tokenizer():
    global tokenizer_obj
    if tokenizer_obj is None:
        try:
            # SudachiDict-core を使用
            tokenizer_obj = dictionary.Dictionary().create()
        except Exception as e:
            print(f"Error initializing Sudachi: {e}")
            return None
    return tokenizer_obj

def convert_to_kana(text, tok):
    if not text:
        return ""

    # 形態素解析を実行
    mode = tokenizer.Tokenizer.SplitMode.C
    morphemes = tok.tokenize(text, mode)

    # 各形態素の読み（カタカナ）を連結
    kana_list = []
    for m in morphemes:
        # 読み（reading_form）を取得。取得できない場合は辞書引きの表記をそのまま使う
        reading = m.reading_form()
        if reading:
            kana_list.append(reading)
        else:
            kana_list.append(m.surface())

    return "".join(kana_list)

@functions_framework.http
def fn_to_kana(request):
    """BigQuery Remote Function for Katakana conversion.
    Input format: {"calls": [["漢字"], ["ひらがな"], ...]}
    Output format: {"replies": ["カンジ", "ヒラガナ", ...]}
    """
    request_json = request.get_json(silent=True)
    if not request_json or 'calls' not in request_json:
        return jsonify({"replies": []})

    tok = get_tokenizer()
    if not tok:
        # 初期化失敗時は入力値をそのまま返す（縮退運転）
        return jsonify({"replies": [c[0] for c in request_json['calls']]})

    replies = []
    calls = request_json['calls']

    for call in calls:
        if not call or len(call) == 0:
            replies.append("")
            continue

        text = call[0]
        try:
            # カタカナ変換実行
            kana = convert_to_kana(text, tok)
            replies.append(kana)
        except Exception as e:
            print(f"Conversion error for '{text}': {e}")
            replies.append(text)

    return jsonify({"replies": replies})
