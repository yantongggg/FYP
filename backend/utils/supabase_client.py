import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Initialize Supabase client
supabase_client: Client = None

try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully")
    else:
        logger.warning("Supabase credentials not found in environment variables")
        # Create a mock client for development
        class MockSupabaseClient:
            def table(self, table_name):
                return MockTable(table_name)
        
        supabase_client = MockSupabaseClient()
        logger.info("Using mock Supabase client for development")

except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {str(e)}")
    # Fallback to mock client
    class MockSupabaseClient:
        def table(self, table_name):
            return MockTable(table_name)
    
    supabase_client = MockSupabaseClient()

class MockTable:
    
    def __init__(self, table_name):
        self.table_name = table_name
        self._data = []
    
    def insert(self, data):
        # Simulate insert operation
        if isinstance(data, list):
            for item in data:
                item['id'] = f"mock_{len(self._data)}"
                self._data.append(item)
        else:
            data['id'] = f"mock_{len(self._data)}"
            self._data.append(data)
        
        return MockResponse(self._data[-1:] if not isinstance(data, list) else self._data[-len(data):])
    
    def select(self, columns='*'):
        return MockQuery(self._data)
    
    def update(self, data):
        return MockQuery(self._data, update_data=data)
    
    def delete(self):
        return MockQuery(self._data, delete=True)

class MockQuery:
    
    def __init__(self, data, update_data=None, delete=False):
        self._data = data
        self._update_data = update_data
        self._delete = delete
        self._filters = []
    
    def eq(self, column, value):
        self._filters.append(('eq', column, value))
        return self
    
    def order(self, column, desc=False):
        return self
    
    def limit(self, count):
        return self
    
    def single(self):
        result = self._apply_filters()
        return MockResponse(result[0] if result else None)
    
    def execute(self):
        result = self._apply_filters()
        return MockResponse(result)
    
    def _apply_filters(self):
        result = self._data.copy()
        
        for filter_type, column, value in self._filters:
            if filter_type == 'eq':
                result = [item for item in result if item.get(column) == value]
        
        if self._update_data:
            for item in result:
                item.update(self._update_data)
        
        if self._delete:
            for item in result:
                if item in self._data:
                    self._data.remove(item)
        
        return result

class MockResponse:
    
    def __init__(self, data):
        self.data = data if isinstance(data, list) else [data] if data is not None else []

# Export the client
__all__ = ['supabase_client']