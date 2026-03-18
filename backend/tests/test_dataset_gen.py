import pandas as pd
import random

# 1. Create sample.csv (100 entries)
names = ["Alice", "Bob", "Charlie", "Diana", "Edward", "Fiona", "George", "Hannah", "Ian", "Julia"]
cities = ["New York", "London", "Paris", "Tokyo", "Berlin", "Sydney", "Toronto", "Madrid", "Mumbai", "Seoul"]

data = {
    "name": [f"{random.choice(names)} {i}" for i in range(1, 101)],
    "age": [random.randint(22, 65) for _ in range(100)],
    "city": [random.choice(cities) for _ in range(100)]
}

df = pd.DataFrame(data)
df.to_csv('sample.csv', index=False)
print("✅ Created sample.csv")

# 2. Create sample.xlsx (Standard Excel Binary)
# Note: Requires 'openpyxl' library (pip install openpyxl)
try:
    df.to_excel('sample.xlsx', index=False)
    print("✅ Created sample.xlsx")
except ImportError:
    print("❌ Could not create .xlsx (Install openpyxl with: pip install openpyxl)")

# 3. Create corrupt.csv (Actually a malformed text file)
with open('corrupt.csv', 'w') as f:
    f.write("This is a total trap!\n")
    f.write("User_ID: 9999\n")
    f.write("INTERNAL_SERVER_ERROR: {system_failure}\n")
    f.write("01010100 01101000 01101001 01110011") 
print("✅ Created corrupt.csv (fake file)")