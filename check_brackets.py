with open('mobile_app/lib/screens/inspection_page.dart', 'r') as f:
    text = f.read()

brackets = {'(': ')', '[': ']', '{': '}'}
stack = []
for i, char in enumerate(text):
    if char in brackets:
        stack.append((char, i))
    elif char in brackets.values():
        if not stack:
            print(f"Extra closing bracket '{char}' at index {i}")
            break
        top, idx = stack.pop()
        if brackets[top] != char:
            print(f"Mismatched bracket at index {i}: expected '{brackets[top]}', found '{char}'")
            line = text.count('\n', 0, i) + 1
            print(f"Line number: {line}")
            print(text[max(0, i-50):min(len(text), i+50)])
            break
if stack:
    print(f"Unclosed brackets: {stack}")
