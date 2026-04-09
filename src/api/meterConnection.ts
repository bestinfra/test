import BACKEND_URL from '../config';

// External HES/ATT-Smart API (used when backend proxy is not available)
const isDevelopment = import.meta.env.DEV;
const HES_BASE_URL = isDevelopment
  ? '/api'
  : 'https://arcticterntech.in:8443/attSmart';

export interface AuthResponse {
  jwt: string;
}

export interface MeterStatusResponse {
  isConnected: string; // "1" = Connected, "0" = Disconnected, "2" = unknown (treated as disconnected)
}

export interface SetLoadControlRequest {
  meterSerialNo: string;
  functionCode: string;
  valueToProgram: string;
  transactionId: string;
}

export interface SetLoadControlResponse {
  transactionId: string;
  entity: {
    meterSerialId: string;
    functionCode: string;
    valueToProgram: string;
  };
  message: string;
}

class MeterConnectionAPI {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  // Get authentication token
  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const response = await fetch(`${HES_BASE_URL}/getToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          username: 'att',
          password: 'att@123'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
      }

      const data: AuthResponse = await response.json();
      this.token = data.jwt;
      this.tokenExpiry = Date.now() + 86400000; // 24 hours
      
      return this.token;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to API server. Please check your internet connection and ensure the API server is accessible.');
      }
      throw error;
    }
  }

  // Get meter connection status (tries app backend first, then external HES API)
  async getMeterStatus(meterSerialNo: string): Promise<MeterStatusResponse> {
    // 1) Try app backend endpoint (same-origin / proxy; uses cookie auth)
    try {
      const backendUrl = `${BACKEND_URL.replace(/\/$/, '')}/commands/status/${encodeURIComponent(meterSerialNo)}`;
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        mode: 'cors',
      });

      if (response.ok) {
        const json = await response.json();
        const isConnected = json?.data?.isConnected ?? json?.isConnected;
        if (isConnected !== undefined && isConnected !== null) {
          return { isConnected: String(isConnected) };
        }
      }
    } catch {
      // Fall through to external HES API
    }

    // 2) Fallback: external HES / refreshStatus API
    try {
      const token = await this.getToken();
      const response = await fetch(`${HES_BASE_URL}/refreshStatus/${meterSerialNo}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        mode: 'cors',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get meter status: ${response.status} - ${errorText}`);
      }

      const data: MeterStatusResponse = await response.json();
      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to API server for status check. Please verify the API server is running and accessible.');
      }
      throw error;
    }
  }

  // Connect meter (Function Code 8)
  async connectMeter(meterSerialNo: string, reason: string = ''): Promise<SetLoadControlResponse> {
    try {
      const token = await this.getToken();
      const transactionId = `CONNECT_${meterSerialNo}_${Date.now()}`;
      
      const requestBody: SetLoadControlRequest = {
        meterSerialNo,
        functionCode: '8', // Connect Load
        valueToProgram: reason || 'Manual connection',
        transactionId
      };

      const response = await fetch(`${HES_BASE_URL}/setLoadFunctionControl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to connect meter: ${response.status}`);
      }

      const data: SetLoadControlResponse = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Disconnect meter (Function Code 9)
  async disconnectMeter(meterSerialNo: string, reason: string = ''): Promise<SetLoadControlResponse> {
    try {
      const token = await this.getToken();
      const transactionId = `DISCONNECT_${meterSerialNo}_${Date.now()}`;
      
      const requestBody: SetLoadControlRequest = {
        meterSerialNo,
        functionCode: '9', // Disconnect Load
        valueToProgram: reason || 'Manual disconnection',
        transactionId
      };

      const response = await fetch(`${HES_BASE_URL}/setLoadFunctionControl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect meter: ${response.status}`);
      }

      const data: SetLoadControlResponse = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Utility function to convert API status to readable format
  // Backend/HES convention: "1" = Connected, "0" = Disconnected
  static parseConnectionStatus(apiStatus: string): 'connected' | 'disconnected' {
    switch (String(apiStatus)) {
      case '1':
        return 'connected';
      case '0':
        return 'disconnected';
      case '2':
      default:
        return 'disconnected'; // Default to disconnected for unknown states
    }
  }

  // Utility function to convert readable status to API format
  static formatConnectionStatus(status: 'connected' | 'disconnected'): string {
    switch (status) {
      case 'connected':
        return '0';
      case 'disconnected':
        return '1';
      default:
        return '1'; // Default to disconnected
    }
  }
}

const meterConnectionAPI = new MeterConnectionAPI();
export { MeterConnectionAPI };
export default meterConnectionAPI; 