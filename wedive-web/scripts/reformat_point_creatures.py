import json
import os

def normalize_id(id_str):
    if not id_str:
        return id_str
    return id_str.replace('_', '')

def reformat_point_creatures():
    input_path = 'src/data/backup_20251221/point_creatures_seed.json'
    output_path = 'src/data/point_creatures_seed.json'

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    new_data = []
    for item in data:
        new_point_id = normalize_id(item.get('pointId', ''))
        new_creature_id = normalize_id(item.get('creatureId', ''))

        new_item = {
            'id': f"{new_point_id}_{new_creature_id}",
            'pointId': new_point_id,
            'creatureId': new_creature_id,
            'localRarity': item.get('localRarity', 'Common'),
            'status': item.get('status', 'approved')
        }

        # Preserve other optional fields if present
        if 'reasoning' in item:
            new_item['reasoning'] = item['reasoning']
        if 'confidence' in item:
            new_item['confidence'] = item['confidence']
        if 'lastSighted' in item:
            new_item['lastSighted'] = item['lastSighted']

        new_data.append(new_item)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully reformatted {len(new_data)} entries to {output_path}")

if __name__ == '__main__':
    reformat_point_creatures()
