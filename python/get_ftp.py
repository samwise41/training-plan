import re

def extract_ftp(text):
    """
    Scans text for the 'Cycling FTP' label and returns the integer value.
    Handles various markdown formats like "**Cycling FTP:**" or "Cycling FTP:".
    """
    if not text:
        return None
    
    # Regex explanation:
    # Cycling FTP  -> specific anchor phrase
    # [:\*]* -> matches any combination of colons or asterisks (markdown)
    # \s* -> matches any amount of whitespace
    # (\d+)        -> captures the number (the FTP value)
    pattern = r"Cycling FTP[:\*]*\s*(\d+)"
    
    match = re.search(pattern, text, re.IGNORECASE)
    
    if match:
        return int(match.group(1))
    return None

# Simulating the text content from your 'Master Training Plan' doc
document_text = """
# Master Training Plan 2026
**Last Updated:** December 26, 2025

## 2. User Profile & Health
* **Weight Status:** -25 lbs since April 2025.
* **Cycling FTP:** 241 Watts (Validated Dec 23, 2025 via 60-min Alpe du Zwift).
* **Running Fitness:**
* **Lactate Threshold HR (LTHR):** 171 bpm (Validated Dec 26, 2025).
"""

if __name__ == "__main__":
    ftp_value = extract_ftp(document_text)
    
    if ftp_value:
        print(f"Found FTP: {ftp_value}")
    else:
        print("FTP value not found.")
