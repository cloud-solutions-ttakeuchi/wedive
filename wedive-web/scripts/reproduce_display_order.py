
import os
import sys
import json
import unittest
from unittest.mock import MagicMock, patch

# 1. Set dummy env var BEFORE importing generate_zones
os.environ["GOOGLE_API_KEY"] = "dummy_key"

# Add scripts directory to path to allow import
sys.path.append(os.path.join(os.path.dirname(__file__), 'locations'))

# Import the module under test
import generate_zones

class TestDisplayOrder(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.dirname(os.path.abspath(__file__))
        self.input_file = os.path.join(self.test_dir, "test_target_regions.json")
        self.output_file = os.path.join(self.test_dir, "test_locations_seed.json")
        self.produced_zones_file = os.path.join(self.test_dir, "test_produced_zones.json")

        # Create dummy input data
        with open(self.input_file, 'w') as f:
            json.dump(["TestRegion"], f)

        # Clear output file if exists
        if os.path.exists(self.output_file):
            os.remove(self.output_file)

        # Patch module-level file paths
        generate_zones.INPUT_FILE = self.input_file
        generate_zones.OUTPUT_FILE = self.output_file
        generate_zones.PRODUCED_ZONES_FILE = self.produced_zones_file

    def tearDown(self):
        # Cleanup
        if os.path.exists(self.input_file):
            os.remove(self.input_file)
        if os.path.exists(self.output_file):
            os.remove(self.output_file)
        if os.path.exists(self.produced_zones_file):
            os.remove(self.produced_zones_file)

    @patch('google.generativeai.GenerativeModel')
    def test_display_order_injection(self, mock_model_class):
        # Setup mock response
        mock_model_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = json.dumps([
            {
                "name": "TestRegion",
                "type": "Region",
                "children": [
                    {
                        "name": "NewZone1",
                        "type": "Zone",
                        "description": "Description 1"
                    },
                    {
                        "name": "NewZone2",
                        "type": "Zone",
                        "description": "Description 2"
                    }
                ]
            }
        ])
        mock_model_instance.generate_content.return_value = mock_response
        mock_model_class.return_value = mock_model_instance

        # Run main function
        with patch.object(sys, 'argv', ['generate_zones.py', '--mode', 'clean']):
            generate_zones.main()

        # assertions
        self.assertTrue(os.path.exists(self.output_file), "Output file should be created")

        with open(self.output_file, 'r') as f:
            data = json.load(f)

        self.assertEqual(len(data), 1)
        region = data[0]
        self.assertEqual(region['name'], "TestRegion")
        self.assertEqual(len(region['children']), 2)

        zone1 = region['children'][0]
        zone2 = region['children'][1]

        print(f"\nVerifying Zone 1: {zone1}")
        self.assertIn('displayOrder', zone1)
        self.assertEqual(zone1['displayOrder'], 0)

        print(f"Verifying Zone 2: {zone2}")
        self.assertIn('displayOrder', zone2)
        self.assertEqual(zone2['displayOrder'], 0)

if __name__ == '__main__':
    unittest.main()
