async function testVapiAPI() {
  const url = 'http://localhost:3000/api/vapi/tools';
  
  const mockPayload = {
    message: {
      type: 'tool-calls',
      toolCalls: [
        {
          function: {
            name: 'get_doctors',
            args: {},
            id: 'call_123'
          }
        }
      ]
    }
  };

  console.log("Testing /api/vapi/tools with 'get_doctors'...");
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockPayload)
    });
    
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testVapiAPI();
