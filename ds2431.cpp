#include "pxt.h"

namespace ds2431{
	MicroBitPin *pin = &uBit.io.P2;
	
	void sleep_us(int us){
		int lasttime,nowtime;
		lasttime  = system_timer_current_time_us();
		nowtime = system_timer_current_time_us();
		while((nowtime - lasttime) < us){
			nowtime = system_timer_current_time_us();
		}
	}
	

	void DS2431Rest(void){
		pin->setDigitalValue(0);
		sleep_us(750);
		pin->setDigitalValue(1);
		pin->getDigitalValue();
		sleep_us(15);
	}
	
	
	void DS2431WiteByte(uint8_t data){
	  int _data=0,i;
	  for(i=0;i<8;i++){
		_data=data&0x01;
		data>>=1;
		if(_data){
			pin->setDigitalValue(0);
			sleep_us(2);
			pin->setDigitalValue(1);
			sleep_us(60);
		}else{
			pin->setDigitalValue(0);
			sleep_us(60);
			pin->setDigitalValue(1);
			sleep_us(2);
		}
		//sleep_us(2);
	  }
	}
	

	uint8_t DS2431ReadBit(void){
		uint8_t data;
		pin->setDigitalValue(0);
		sleep_us(2);
		pin->setDigitalValue(1);
		pin->getDigitalValue();
		sleep_us(5);
		if(pin->getDigitalValue())
			data = 1;
		else 
			data = 0;
		sleep_us(50);
		return data;
	}  
	
	
	uint8_t DS2431ReadByte(void){
		uint8_t i; 
		uint8_t data = 0;

		for(i=0;i<8;i++){
			if(DS2431ReadBit())
				data |= 1 << i;
		}
		//uBit.serial.printf("\r\n");
		return data;
	}
	
	
	uint16_t crc16(uint8_t *input, uint16_t len){
		uint8_t i;
		uint16_t crc = 0x0000;   
		while(len--){
			crc ^= *input++;
			for (i = 0; i < 8; ++i){   
				  // Anti-order CRC16
				  // 1. X16+X15+X2+1 = 11000000000000101 		  
				  // 2. The calculation of reverse XOR is used : 11000000000000101 ---> 10100000000000011
				  // 3. The lowest bit of data is not processed : 10100000000000011 ---> 1010000000000001
				  //    (Move (discard) one bit if the lowest bit of both the data and the polynomial is 1)
				  // 4. 1010000000000001 = 0xA001
				if (crc & 0x01)
					crc = (crc >> 1) ^ 0xA001;
				else
					crc = (crc >> 1);
			}
		}
		return crc;
	}
	
	
	bool check_crc16(uint8_t *input, uint16_t len, uint8_t *inverted_crc){
		uint16_t crc = ~crc16(input, len);
		return (crc & 0xFF) == inverted_crc[0] && (crc >> 8) == inverted_crc[1];
	}
	
	
	  //%
	uint8_t Read_byte_from_ds2431(uint16_t address){
		DS2431Rest();
		DS2431WiteByte(0xCC);     // Skip ROM
		DS2431WiteByte(0xF0);     // read memory
		DS2431WiteByte(address & 0xff);
		DS2431WiteByte((address >> 8) & 0xff);	
		return DS2431ReadByte();
	}
	

	  //%
	bool Write_8bytes_to_ds2431(uint8_t *buf, uint16_t address){
		
		bool verify = false;
		uint8_t crc16[2];    // store value of crc
		uint8_t buffer[12];  // data+command = 12bytes
		
		// 1.write scratchpad --> Write data to the scratchpad
		buffer[0] = 0x0F;                   // store commands --> write scratchpad
		buffer[1] = address & 0xff;         // address
		buffer[2] = (address >> 8) & 0xff;
		memcpy(&buffer[3], buf, 8);         // 8 bytes data
		if(buf[0] == 99 && buf[1] == 99 && buf[2] == 99)
			return true;
		else
			return false;
		/*
		DS2431Rest();                       // start
		DS2431WiteByte(0xCC);               // CMD ---> Skip ROM	
		DS2431WiteByte(buffer[0]);          // CMD ---> write scratchpad   
		DS2431WiteByte(buffer[1]);          // address
		DS2431WiteByte(buffer[2]);	

		for (uint8_t i = 3 ; i < 11; i++)  // write 8 bytes data to eeprom
			DS2431WiteByte(buffer[i]);
		
		crc16[0] = DS2431ReadByte();         // Read CRC-16
		crc16[1] = DS2431ReadByte();
		if (!check_crc16(buffer, 11, crc16))
			verify = true; //CRC not matching, try to read again
		
		// 2.read scratchpad --> Read data from the scratchpad
		buffer[0] = 0xAA;                   // store commands --> read scratchpad
		DS2431Rest();                        // start
		DS2431WiteByte(0xCC);               // CMD ---> Skip ROM	
		DS2431WiteByte(buffer[0]);          // CMD ---> read scratchpad
		
		for(uint8_t i=1;i<4;i++)            //Read TA1(Low address), TA2(High address) and E/S
			buffer[i] = DS2431ReadByte();

		if (buffer[3] != 0x07)              // E/S must be equal to 0x07(8 bytes data)
		  return false;

		if(verify){
			for (uint8_t i = 4 ; i < 12 ; i++) //Read the data of scratchpad(8 bytes)
				buffer[i] = DS2431ReadByte();
	  
			crc16[0] = DS2431ReadByte();        // Read CRC-16
			crc16[1] = DS2431ReadByte();
			if (!check_crc16(buffer, 12, crc16))  // CRC not matching.
				return false;              
		}

		// 3.Copy scratchpad --> Write the data in the scratchpad to memory
		buffer[0] = 0x55;          // CMD --> Copy scratchpad
		DS2431Rest();               // start
		DS2431WiteByte(0xCC);      // CMD ---> Skip ROM
		for(uint8_t i=0;i<4;i++)   //Send authorization code (TA1, TA2, E/S)
			DS2431WiteByte(buffer[i]);

		fiber_sleep(15);;                // t_PROG = 12.5ms worst case.
		uint8_t res = DS2431ReadByte();  // Read copy status, 0xAA = success
		if (res != 0xAA) {         
			return false;
		}
		
		return true;*/
	}
	
}
	
