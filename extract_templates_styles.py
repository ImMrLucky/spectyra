#!/usr/bin/env python3
"""
Script to extract inline templates and styles from Angular components
Usage: python3 extract_templates_styles.py <component-file.ts>
"""

import re
import sys
import os
from pathlib import Path

def extract_template_and_styles(file_path):
    """Extract template and styles from a component file"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find template
    template_match = re.search(r'template:\s*`([^`]*(?:`[^`]*)*)`', content, re.DOTALL)
    if not template_match:
        print(f"No template found in {file_path}")
        return False
    
    template_content = template_match.group(1)
    
    # Find styles
    styles_match = re.search(r'styles:\s*\[\s*`([^`]*(?:`[^`]*)*)`\s*\]', content, re.DOTALL)
    if not styles_match:
        print(f"No styles found in {file_path}")
        return False
    
    styles_content = styles_match.group(1)
    
    # Determine output file names
    base_path = Path(file_path)
    base_name = base_path.stem  # e.g., "login.page" or "org-switcher.component"
    html_file = base_path.parent / f"{base_name}.html"
    css_file = base_path.parent / f"{base_name}.css"
    
    # Write HTML file
    with open(html_file, 'w') as f:
        f.write(template_content.strip() + '\n')
    
    # Write CSS file
    with open(css_file, 'w') as f:
        f.write(styles_content.strip() + '\n')
    
    # Update component file
    # Replace template with templateUrl
    new_content = content.replace(
        template_match.group(0),
        f"templateUrl: './{base_name}.html',"
    )
    
    # Replace styles with styleUrls
    new_content = new_content.replace(
        styles_match.group(0),
        f"styleUrls: ['./{base_name}.css'],"
    )
    
    # Write updated component file
    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print(f"✅ Extracted {file_path}")
    print(f"   → {html_file}")
    print(f"   → {css_file}")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 extract_templates_styles.py <component-file.ts>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)
    
    extract_template_and_styles(file_path)
