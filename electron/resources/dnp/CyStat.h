
//
// CyStat.h
// 

#include <windows.h>
#include <stdio.h>
#include <winioctl.h>
#include "Cyioctl.h"

#ifndef _CVSTAT_H_
#define _CVSTAT_H_

#define GROUP_USUALLY			0x00010000
#define GROUP_SETTING			0x00020000
#define GROUP_HARDWARE			0x00040000
#define GROUP_SYSTEM			0x00080000
#define GROUP_FLSHPROG			0x00100000

#define STATUS_ERROR			0x80000000

#define STATUS_USUALLY_IDLE		GROUP_USUALLY | 0x0001
#define STATUS_USUALLY_PRINTING		GROUP_USUALLY | 0x0002
#define STATUS_USUALLY_STANDSTILL	GROUP_USUALLY | 0x0004
#define STATUS_USUALLY_PAPER_END	GROUP_USUALLY | 0x0008
#define STATUS_USUALLY_RIBBON_END	GROUP_USUALLY | 0x0010
#define STATUS_USUALLY_COOLING		GROUP_USUALLY | 0x0020
#define STATUS_USUALLY_MOTCOOLING	GROUP_USUALLY | 0x0040

#define STATUS_SETTING_COVER_OPEN	GROUP_SETTING | 0x0001
#define STATUS_SETTING_PAPER_JAM	GROUP_SETTING | 0x0002
#define STATUS_SETTING_RIBBON_ERR	GROUP_SETTING | 0x0004
#define STATUS_SETTING_PAPER_ERR	GROUP_SETTING | 0x0008
#define STATUS_SETTING_DATA_ERR	        GROUP_SETTING | 0x0010
#define STATUS_SETTING_SCRAPBOX_ERR     GROUP_SETTING | 0x0020

#define STATUS_HARDWARE_ERR01		GROUP_HARDWARE | 0x0001
#define STATUS_HARDWARE_ERR02		GROUP_HARDWARE | 0x0002
#define STATUS_HARDWARE_ERR03		GROUP_HARDWARE | 0x0004
#define STATUS_HARDWARE_ERR04		GROUP_HARDWARE | 0x0008
#define STATUS_HARDWARE_ERR05		GROUP_HARDWARE | 0x0010
#define STATUS_HARDWARE_ERR06		GROUP_HARDWARE | 0x0020
#define STATUS_HARDWARE_ERR07		GROUP_HARDWARE | 0x0040
#define STATUS_HARDWARE_ERR08		GROUP_HARDWARE | 0x0080
#define STATUS_HARDWARE_ERR09		GROUP_HARDWARE | 0x0100
#define STATUS_HARDWARE_ERR10		GROUP_HARDWARE | 0x0200

#define STATUS_SYSTEM_ERR01		GROUP_SYSTEM | 0x0001

#define STATUS_FLSHPROG_IDLE		GROUP_FLSHPROG + 0x0001
#define STATUS_FLSHPROG_WRITING	        GROUP_FLSHPROG + 0x0002
#define STATUS_FLSHPROG_FINISHED	GROUP_FLSHPROG + 0x0004
#define STATUS_FLSHPROG_DATA_ERR1	GROUP_FLSHPROG + 0x0008
#define STATUS_FLSHPROG_DEVICE_ERR1     GROUP_FLSHPROG + 0x0010
#define STATUS_FLSHPROG_OTHERS_ERR1     GROUP_FLSHPROG + 0x0020

#define CUTTER_MODE_STANDARD		0x00000000		/*   0 */
#define CUTTER_MODE_NONSCRAP		0x00000001		/*   1 */
#define CUTTER_MODE_2INCHCUT		0x00000078		/* 120 */ 

#define RETENTION_MODE_OFF		0x00000000
#define RETENTION_MODE_ON		0x00000001 

#define CWD_300DPI			0x00000000
#define CWD_600DPI			0x00000001 

/* For CV Printers Item */

#define CVG_USUALLY			0x00010000
#define CVG_SETTING			0x00020000
#define CVG_HARDWARE			0x00040000
#define CVG_SYSTEM			0x00080000
#define CVG_FLSHPROG			0x00100000

#define CVSTATUS_ERROR			0x80000000

#define CVS_USUALLY_IDLE		CVG_USUALLY | 0x0001
#define CVS_USUALLY_PRINTING		CVG_USUALLY | 0x0002
#define CVS_USUALLY_STANDSTILL		CVG_USUALLY | 0x0004
#define CVS_USUALLY_PAPER_END		CVG_USUALLY | 0x0008
#define CVS_USUALLY_RIBBON_END		CVG_USUALLY | 0x0010
#define CVS_USUALLY_COOLING		CVG_USUALLY | 0x0020
#define CVS_USUALLY_MOTCOOLING		CVG_USUALLY | 0x0040

#define CVS_SETTING_COVER_OPEN		CVG_SETTING | 0x0001
#define CVS_SETTING_PAPER_JAM		CVG_SETTING | 0x0002
#define CVS_SETTING_RIBBON_ERR		CVG_SETTING | 0x0004
#define CVS_SETTING_PAPER_ERR		CVG_SETTING | 0x0008
#define CVS_SETTING_DATA_ERR		CVG_SETTING | 0x0010
#define CVS_SETTING_SCRAPBOX_ERR	CVG_SETTING | 0x0020

#define CVS_HARDWARE_ERR01		CVG_HARDWARE | 0x0001
#define CVS_HARDWARE_ERR02		CVG_HARDWARE | 0x0002
#define CVS_HARDWARE_ERR03		CVG_HARDWARE | 0x0004
#define CVS_HARDWARE_ERR04		CVG_HARDWARE | 0x0008
#define CVS_HARDWARE_ERR05		CVG_HARDWARE | 0x0010
#define CVS_HARDWARE_ERR06		CVG_HARDWARE | 0x0020
#define CVS_HARDWARE_ERR07		CVG_HARDWARE | 0x0040
#define CVS_HARDWARE_ERR08		CVG_HARDWARE | 0x0080
#define CVS_HARDWARE_ERR09		CVG_HARDWARE | 0x0100
#define CVS_HARDWARE_ERR10              CVG_HARDWARE | 0x0200

#define CVS_SYSTEM_ERR01		CVG_SYSTEM | 0x0001

#define CVS_FLSHPROG_IDLE		CVG_FLSHPROG + 0x0001
#define CVS_FLSHPROG_WRITING		CVG_FLSHPROG + 0x0002
#define CVS_FLSHPROG_FINISHED		CVG_FLSHPROG + 0x0004
#define CVS_FLSHPROG_DATA_ERR1		CVG_FLSHPROG + 0x0008
#define CVS_FLSHPROG_DEVICE_ERR1	CVG_FLSHPROG + 0x0010
#define CVS_FLSHPROG_OTHERS_ERR1	CVG_FLSHPROG + 0x0020

#ifdef __cplusplus
extern "C" {
#endif

long APIENTRY PortInitialize( LPWSTR p );
long APIENTRY CvInitialize( LPWSTR p );

long APIENTRY CvGetVersion( long lPortNum, LPSTR p );
long APIENTRY CvGetSensorInfo( long lPortNum, LPSTR p );
long APIENTRY CvGetResolutionH( long lPortNum );
long APIENTRY CvGetResolutionV( long lPortNum );
long APIENTRY CvGetMedia( long lPortNum, LPSTR p );
long APIENTRY CvGetStatus( long lPortNum );

long APIENTRY CvGetCounterL( long lPortNum );
long APIENTRY CvGetCounterA( long lPortNum );
long APIENTRY CvGetCounterB( long lPortNum );
BOOL APIENTRY CvSetClearCounterA( long lPortNum );
BOOL APIENTRY CvSetClearCounterB( long lPortNum );

long APIENTRY CvGetFreeBuffer( long lPortNum );
long APIENTRY CvGetPQTY( long lPortNum );
long APIENTRY CvGetMediaCounter( long lPortNum );
long APIENTRY CvGetMediaColorOffset( long lPortNum );
long APIENTRY CvGetMediaLotNo( long lPortNum, LPSTR p );
long APIENTRY CvGetSerialNo( long lPortNum, LPSTR p );

BOOL APIENTRY CvSetFirmwUpdateMode( long lPortNum );
BOOL APIENTRY CvSetFirmwDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );
BOOL APIENTRY CvSetColorDataClear( long lPortNum );
BOOL APIENTRY CvSetColorDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );
BOOL APIENTRY CvSetColorDataVersion( long lPortNum, LPSTR dBuff, DWORD bLen );
long APIENTRY CvGetColorDataVersion( long lPortNum, LPSTR p );
long APIENTRY CvGetColorDataChecksum( long lPortNum, LPSTR p );

BOOL APIENTRY CvSetCommand( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen );
long APIENTRY CvGetCommandEX( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen, LPSTR lpRetBuff, DWORD dwRetBuffSize );


long APIENTRY GetFirmwVersion( long lPortNum, LPSTR p );
long APIENTRY GetSensorInfo( long lPortNum, LPSTR p );
long APIENTRY GetResolutionH( long lPortNum );
long APIENTRY GetResolutionV( long lPortNum );
long APIENTRY GetMedia( long lPortNum, LPSTR p );
long APIENTRY GetStatus( long lPortNum );

long APIENTRY GetCounterL( long lPortNum );
long APIENTRY GetCounterA( long lPortNum );
long APIENTRY GetCounterB( long lPortNum );
long APIENTRY GetCounterP( long lPortNum );
long APIENTRY GetCounterMatte( long lPortNum );
long APIENTRY GetCounterM( long lPortNum );
BOOL APIENTRY SetClearCounterA( long lPortNum );
BOOL APIENTRY SetClearCounterB( long lPortNum );
BOOL APIENTRY SetCounterP( long lPortNum, long lCounter );
BOOL APIENTRY SetClearCounterM( long lPortNum );

long APIENTRY GetFreeBuffer( long lPortNum );
long APIENTRY GetPQTY( long lPortNum );
long APIENTRY GetMediaCounter( long lPortNum );
long APIENTRY GetMediaCounter_R( long lPortNum );
long APIENTRY GetMediaColorOffset( long lPortNum );
long APIENTRY GetMediaLotNo( long lPortNum, LPSTR p );
long APIENTRY GetSerialNo( long lPortNum, LPSTR p );

BOOL APIENTRY SetFirmwUpdateMode( long lPortNum );
BOOL APIENTRY SetFirmwDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );
BOOL APIENTRY SetColorDataClear( long lPortNum );
BOOL APIENTRY SetColorDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );
BOOL APIENTRY SetColorDataVersion( long lPortNum, LPSTR dBuff, DWORD bLen );
long APIENTRY GetColorDataVersion( long lPortNum, LPSTR p );
long APIENTRY GetColorDataChecksum( long lPortNum, LPSTR p );
long APIENTRY GetMediaIdSetInfo( long lPortNum );
long APIENTRY SetCutterMode( long lPortNum, DWORD ctMode );

BOOL APIENTRY SetCommand( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen );
long APIENTRY GetCommandEX( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen, LPSTR lpRetBuff, DWORD dwRetBuffSize );


long APIENTRY GetRfidMediaClass( long lPortNum, LPSTR p );
long APIENTRY GetRfidReserveData( long lPortNum, LPSTR p, DWORD dwPage );
long APIENTRY GetInitialMediaCount( long lPortNum );

long APIENTRY GetMediaCountOffset( long lPortNum );
BOOL APIENTRY SetUSBSerialEnable( long lPortNum, DWORD dwEnable );
long APIENTRY GetUSBSerialEnable( long lPortNum );

long APIENTRY CvGetHeadRank( long lPortNum );
long APIENTRY GetHeadRank( long lPortNum );
BOOL APIENTRY SetLength8( char *lenptr, int length );


#ifdef __cplusplus
}
#endif

#endif

