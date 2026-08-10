import sqlite3

# This automatically creates 'my_database.db' if it does not exist
connection = sqlite3.connect("my_database.db")

# Close the connection
connection.close()
