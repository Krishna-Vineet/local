
/*				*/
/* CspStat.h	*/
/* 				*/
#ifndef _CSPSTAT_H_
#define _CSPSTAT_H_

#define CV_DEF		(1)		/* CV				*/
#define CW_DEF		(2)		/* CW				*/
#define CX_DEF		(3)		/* DS40				*/
#define CXW_DEF		(4)		/* DS80				*/
#define CY_DEF		(5)		/* DS-RX1			*/
#define CW2_DEF		(6)		/* CW2				*/
#define DPTC_DEF	(7)		/* DP-TC10			*/
#define DS80DUP_DEF	(8)		/* DP-DS80D			*/
#define TOWER_DEF	(10)	/* Tower controller	*/
#define DS620_DEF	(20)	/* DP-DS620			*/
#define DS620H_DEF	(21)	/* DP-DS620	HERTZ	*/
#define DS622_DEF	(22)	/* DP-DS622			*/
#define DS820_DEF	(30)	/* DP-DS820			*/
#define QW410_DEF	(35)	/* DP-QW410			*/
#define DS820DX_DEF	(40)	/* DP-DS802DX		*/

#define YELLOW	(0)
#define MAGENTA	(1)
#define CYAN	(2)
#define OP		(3)

#define RESOLUTION300 (300)
#define RESOLUTION334 (334)
#define RESOLUTION600 (600)
#define GROUP_USUALLY				(0x00010000)
#define GROUP_SETTING				(0x00020000)
#define GROUP_HARDWARE				(0x00040000)
#define GROUP_SYSTEM				(0x00080000)
#define GROUP_FLSHPROG				(0x00100000)
#ifdef DUPLEX
 #define GROUP_DUNIT				(0x00200000)
 #define GROUP_HARDWARE2			(0x00400000)
#endif	/* end DUPLEX */

#define STATUS_ERROR				(0x80000000)

#define CSPSTATUS_TIMEOUT			(0x80000001)

#define STATUS_USUALLY_IDLE			( GROUP_USUALLY | 0x0001 )
#define STATUS_USUALLY_PRINTING		( GROUP_USUALLY | 0x0002 )
#define STATUS_USUALLY_STANDSTILL	( GROUP_USUALLY | 0x0004 )
#define STATUS_USUALLY_PAPER_END	( GROUP_USUALLY | 0x0008 )
#define STATUS_USUALLY_RIBBON_END	( GROUP_USUALLY | 0x0010 )
#define STATUS_USUALLY_COOLING		( GROUP_USUALLY | 0x0020 )
#define STATUS_USUALLY_MOTCOOLING	( GROUP_USUALLY | 0x0040 )
#define STATUS_USUALLY_STANDBY_MODE	( GROUP_USUALLY | 0x0080 )

/* CXM */
#define STATUS_USUALLY_SHOOTING		( GROUP_USUALLY | 0x0080 )
#define STATUS_USUALLY_BACKPRINT	( GROUP_USUALLY | 0x0100 )
#ifdef DUPLEX
#define STATUS_USUALLY_WAIT_RESTART	( GROUP_USUALLY | 0x0200 )
#endif	/* end DUPLEX */

#define STATUS_SETTING_COVER_OPEN			( GROUP_SETTING | 0x0001 )
#define STATUS_SETTING_PAPER_JAM			( GROUP_SETTING | 0x0002 )
#define STATUS_SETTING_RIBBON_ERR			( GROUP_SETTING | 0x0004 )
#define STATUS_SETTING_PAPER_ERR			( GROUP_SETTING | 0x0008 )
#define STATUS_SETTING_DATA_ERR				( GROUP_SETTING | 0x0010 )
#define STATUS_SETTING_SCRAPBOX_ERR			( GROUP_SETTING | 0x0020 )
#ifdef DUPLEX
 #define STATUS_SETTING_TRAY_OPEN			( GROUP_SETTING | 0x0040 )
 #define STATUS_SETTING_TRASHBOX_FULL		( GROUP_SETTING | 0x0080 )
#endif	/* end DUPLEX */


#define STATUS_HARDWARE_ERR01		( GROUP_HARDWARE | 0x0001 )
#define STATUS_HARDWARE_ERR02		( GROUP_HARDWARE | 0x0002 )
#define STATUS_HARDWARE_ERR03		( GROUP_HARDWARE | 0x0004 )
#define STATUS_HARDWARE_ERR04		( GROUP_HARDWARE | 0x0008 )
#define STATUS_HARDWARE_ERR05		( GROUP_HARDWARE | 0x0010 )
#define STATUS_HARDWARE_ERR06		( GROUP_HARDWARE | 0x0020 )
#define STATUS_HARDWARE_ERR07		( GROUP_HARDWARE | 0x0040 )
#define STATUS_HARDWARE_ERR08		( GROUP_HARDWARE | 0x0080 )
#define STATUS_HARDWARE_ERR09		( GROUP_HARDWARE | 0x0100 )
#define STATUS_HARDWARE_ERR10		( GROUP_HARDWARE | 0x0200 )
#define STATUS_HARDWARE_ERR11		( GROUP_HARDWARE | 0x0400 )	/* RS422 Error */
#define STATUS_HARDWARE_ERR12		( GROUP_HARDWARE | 0x0800 )

#ifdef DUPLEX
 #define STATUS_HARDWARE2_ERR01		( GROUP_HARDWARE2 | 0x0001 )
 #define STATUS_HARDWARE2_ERR02		( GROUP_HARDWARE2 | 0x0002 )
 #define STATUS_HARDWARE2_ERR03		( GROUP_HARDWARE2 | 0x0004 )
 #define STATUS_HARDWARE2_ERR04		( GROUP_HARDWARE2 | 0x0008 )
 #define STATUS_HARDWARE2_ERR05		( GROUP_HARDWARE2 | 0x0010 )
 #define STATUS_HARDWARE2_ERR06		( GROUP_HARDWARE2 | 0x0020 )
 #define STATUS_HARDWARE2_ERR07		( GROUP_HARDWARE2 | 0x0040 )
#endif	/* end DUPLEX */

/* CXM */
#define STATUS_CXM_RS422_STOP		( STATUS_HARDWARE_ERR11 )

#define STATUS_SYSTEM_ERR01			( GROUP_SYSTEM | 0x0001 )

#define STATUS_FLSHPROG_IDLE		( GROUP_FLSHPROG | 0x0001 )
#define STATUS_FLSHPROG_WRITING		( GROUP_FLSHPROG | 0x0002 )
#define STATUS_FLSHPROG_FINISHED	( GROUP_FLSHPROG | 0x0004 )
#define STATUS_FLSHPROG_DATA_ERR1	( GROUP_FLSHPROG | 0x0008 )
#define STATUS_FLSHPROG_DEVICE_ERR1 ( GROUP_FLSHPROG | 0x0010 )
#define STATUS_FLSHPROG_OTHERS_ERR1 ( GROUP_FLSHPROG | 0x0020 )

#ifdef DUPLEX
 
#define UCS_NON_ERROR			(0)
#define UCS_JAMMING_SUPPLY_SENS_ON	( GROUP_DUNIT | 0x11 )
#define UCS_JAMMING_SUPPLY_SENS_OFF ( GROUP_DUNIT | 0x12 )
#define UCS_JAMMING_SLOT_SENS_ON	( GROUP_DUNIT | 0x13 )
#define UCS_JAMMING_SLOT_SENS_OFF	( GROUP_DUNIT | 0x14 )
#define UCS_JAMMING_PASS_SENS_ON	( GROUP_DUNIT | 0x15 )
#define UCS_JAMMING_PASS_SENS_OFF	( GROUP_DUNIT | 0x16 )
#define UCS_JAMMING_SHELL_SENS1_ON	( GROUP_DUNIT | 0x17 )
#define UCS_JAMMING_SHELL_SENS1_OFF	( GROUP_DUNIT | 0x18 )
#define UCS_JAMMING_SHELL_SENS2_ON	( GROUP_DUNIT | 0x19 )
#define UCS_JAMMING_SHELL_SENS2_OFF	( GROUP_DUNIT | 0x1a )
#define UCS_JAMMING_EJECT_SENS_ON	( GROUP_DUNIT | 0x1b )
#define UCS_JAMMING_EJECT_SENS_OFF	( GROUP_DUNIT | 0x1c )
#define UCS_JAMMING_SLOT_FG_SENS	( GROUP_DUNIT | 0x1d )
#define UCS_JAMMING_SHELL_FG_SENS	( GROUP_DUNIT | 0x1e )
#define UCS_JAMMING_PAPER_JAM		( GROUP_DUNIT | 0x1f )

#define UCS_REMAIN_SUPPLY_SENS		( GROUP_DUNIT | 0x21 )
#define UCS_REMAIN_SLOT_SENS		( GROUP_DUNIT | 0x22 )
#define UCS_REMAIN_PASS_SENS		( GROUP_DUNIT | 0x23 )
#define UCS_REMAIN_SHELL_SENS1		( GROUP_DUNIT | 0x24 )
#define UCS_REMAIN_SHELL_SENS2		( GROUP_DUNIT | 0x25 )
#define UCS_REMAIN_EJECT_SENS		( GROUP_DUNIT | 0x26 )

#define UCS_CAPSTAN_TRAPZ_ERROR		( GROUP_DUNIT | 0x31 )
#define UCS_SHELL_ROLLER_ERROR		( GROUP_DUNIT | 0x41 )
#define UCS_PINCH_OPEN_ERROR		( GROUP_DUNIT | 0x51 )
#define UCS_PINCH_CLOSE_ERROR		( GROUP_DUNIT | 0x52 )
#define UCS_PINCH_INIT_ERROR		( GROUP_DUNIT | 0x53 )
#define UCS_PINCH_POS_UNKNOWN		( GROUP_DUNIT | 0x54 )
#define UCS_PASS_GUIDE_SUPPLY_ERROR	( GROUP_DUNIT | 0x61 )
#define UCS_PASS_GUIDE_SHELL_ERROR	( GROUP_DUNIT | 0x62 )
#define UCS_PASS_GUIDE_EJECT_ERROR	( GROUP_DUNIT | 0x63 )
#define UCS_PASS_GUIDE_INIT_ERROR	( GROUP_DUNIT | 0x64 )
#define UCS_PASS_GUIDE_POS_UNKNOWN	( GROUP_DUNIT | 0x65 )
#define UCS_SIDE_GUIDE_HOME_ERROR	( GROUP_DUNIT | 0x71 )
#define UCS_SIDE_GUIDE_POS_ERROR	( GROUP_DUNIT | 0x72 )
#define UCS_SIDE_GUIDE_INIT_ERROR	( GROUP_DUNIT | 0x73 )
#define UCS_ACT_GUIDE_HOME_ERROR	( GROUP_DUNIT | 0x81 )
#define UCS_SHELL_ROTATE_HOME_ERROR	( GROUP_DUNIT | 0x91 )
#define UCS_SHELL_ROTATE_REV_ERROR	( GROUP_DUNIT | 0x92 )
#define UCS_LEVER_DOWN_ERROR		( GROUP_DUNIT | 0xa1 )
#define UCS_LEVER_LOCK_ERROR		( GROUP_DUNIT | 0xa2 )
#define UCS_LEVER_UP_ERROR			( GROUP_DUNIT | 0xa3 )
#define UCS_CUTTER_HOME_ERROR		( GROUP_DUNIT | 0xb1 )
#define UCS_CUTTER_AWAY_ERROR		( GROUP_DUNIT | 0xb2 )
#define UCS_CUTTER_INIT_ERROR		( GROUP_DUNIT | 0xb3 )
#define UCS_CUTTER_POS_UNKNOWN		( GROUP_DUNIT | 0xb4 )
#define UCS_TRAY_OUT				( GROUP_DUNIT | 0xc1 )
#define UCS_TOP_COVER_OPEN			( GROUP_DUNIT | 0xd1 )
#define UCS_SYSTEM_ERROR			( GROUP_DUNIT | 0xf1 )
#define UCS_NONCONNECT				( GROUP_DUNIT | 0x1f4 )	/* 0x1f4=500 */

#define UNIT_ERROR_JAMMING_SUPPLY	( GROUP_DUNIT | 0x11 )
#define UNIT_ERROR_JAMMING_PASS		( GROUP_DUNIT | 0x13 )
#define UNIT_ERROR_JAMMING_SHELL	( GROUP_DUNIT | 0x17 )
#define UNIT_ERROR_JAMMING_EJECT	( GROUP_DUNIT | 0x1b )
#define UNIT_ERROR_JAMMING_REMOVE	( GROUP_DUNIT | 0x1e )
#define UNIT_ERROR_CAPSTAN_MOTOR	( GROUP_DUNIT | 0x31 )
#define UNIT_ERROR_SHELL_MOTOR		( GROUP_DUNIT | 0x41 )
#define UNIT_ERROR_PINCH			( GROUP_DUNIT | 0x51 )
#define UNIT_ERROR_PASS_GUIDE		( GROUP_DUNIT | 0x61 )
#define UNIT_ERROR_SKEW_GUIDE		( GROUP_DUNIT | 0x71 )
#define UNIT_ERROR_SKEW_REJECT		( GROUP_DUNIT | 0x81 )
#define UNIT_ERROR_SHELL_ROTATE		( GROUP_DUNIT | 0x91 )
#define UNIT_ERROR_LEVER			( GROUP_DUNIT | 0xa1 )
#define UNIT_ERROR_CUTTER			( GROUP_DUNIT | 0xb1 )
#define UNIT_ERROR_TRASHBOX_OUT		( GROUP_DUNIT | 0xc1 )
#define UNIT_ERROR_COVER_OUT		( GROUP_DUNIT | 0xd1 )
#define UNIT_ERROR_SYSTEM			( GROUP_DUNIT | 0xf1 )

#define STATUS_UNIT_RS422_STOP		( STATUS_HARDWARE_ERR11 )

#endif	/* end DUPLEX */

#define CSP_MEDIA_CLASS_CV		(1)
#define CSP_MEDIA_CLASS_CW		(10)
#define CSP_MEDIA_CLASS_CX		(20)
#define CSP_MEDIA_CLASS_CXW 	(30)
#define CSP_MEDIA_CLASS_UNKNOWN (0)

/* Media Code */
#define MEDIA_L				(200)
#define MEDIA_2L			(210)
#define MEDIA_PC			(301)
#define MEDIA_A5			(310)
#define MEDIA_A5W			(400)
#define MEDIA_8x10			(500)
#define MEDIA_8x12			(510)
#define MEDIA_TC86x61		(120)
#define MEDIA_TC127x61		(130)
#define MEDIA_A4			(600)
#define MEDIA_6x10			(410)
#define MEDIA_4x6			(150)
#define MEDIA_4P5x6			(163)
#define MEDIA_4P5x8			(161)

/* Media Size definition */
#define CSP_L									(1)
#define CSP_2L									(2)
#define CSP_PC									(3)
#define CSP_A5									(4)
#define CSP_A5W									(5)
#define CSP_PCx2								(6)
#define CSP_Lx2									(7)
#define CSP_PC_REWIND							(8)
#define CSP_L_REWIND							(9)
#define CSP_5x5									(10)
#define CSP_6x6									(11)
#define CSP_6x4P5								(12)
#define CSP_6x4P5x2								(13)
#define CSP_6x4P5_REWIND						(14)
#define CSP_TC86x61								(21)
#define CSP_TC127x61							(22)
#define CSP_6x10								(23)

// width:8inch
#define CSP_8x7P1								(26)
#define CSP_8x11								(27)
#define CSP_8x10								(31)
#define CSP_8x12								(32)
#define CSP_8x4									(33)
#define CSP_8x5									(34)
#define CSP_8x6									(35)
#define CSP_8x8									(36)
#define CSP_8x4x2								(37)
#define CSP_8x5x2								(38)
#define CSP_8x6x2								(39)
#define CSP_8x5_8x4								(40)
#define CSP_8x6_8x4								(41)
#define CSP_8x6_8x5								(42)
#define CSP_8x8_8x4								(43)
#define CSP_8x4x3								(44)	/* 8x4x3(Roll paper) */
#define CSP_A4_LENGTH							(45)
#define CSP_8x7									(46)
#define CSP_8x9									(47)
#define CSP_8x4_REWIND							(48)
#define CSP_8x5_REWIND							(49)
#define CSP_8x6_REWIND							(50)
#define CSP_8x10_50								(51)
#define CSP_8x10_75								(52)
#define CSP_8x4x3Cut							(53)	/* 8x4x3(Cut paper) */

// width:4/4.5inch
#define CSP_4x4									(54)
#define CSP_4x6									(55)
#define CSP_4x8									(56)
#define CSP_4P5x4P5								(57)
#define CSP_4P5x6								(58)
#define CSP_4P5x8								(59)
#define CSP_4x3									(60)
#define CSP_4x4P5								(61)
#define CSP_4P5x3								(62)
#define CSP_4P5x4								(63)
#define CSP_4x3x2								(64)
#define CSP_4P5x3x2								(65)
#define CSP_4P5x4x2								(66)

// width:A4(210mm)
#define CSP_A5FORMAT							(71)
#define CSP_A5x2								(72)
#define CSP_A5_REWIND							(73)
#define CSP_A4x5								(74)
#define CSP_A4x6								(75)
#define CSP_A4x8								(76)
#define CSP_A4x10								(77)
#define CSP_A4FORMAT							(78)
#define CSP_A4x5x2								(79)
#define CSP_A4x5_REWIND							(80)

#ifdef DUPLEX
/* Cut paper */
 #define CSP_8x10_CutPaper						(131)
 #define CSP_8x12_CutPaper						(132)
 #define CSP_8x4_CutPaper						(133)
 #define CSP_8x5_CutPaper						(134)
 #define CSP_8x6_CutPaper						(135)
 #define CSP_8x8_CutPaper						(136)
 #define CSP_8x4x2_CutPaper						(137)
 #define CSP_8x5x2_CutPaper						(138)
 #define CSP_8x6x2_CutPaper						(139)
 #define CSP_8x10_50_CutPaper					(151)
 #define CSP_8x10_75_CutPaper					(152)
 #define CSP_8x4x3_CutPaper						(153)
/* Cut paper(Duplex print:Front side) */	
 #define CSP_8x10_35_DuplexCutPaper_F			(225)
 #define CSP_8x7_10_DuplexCutPaper_F			(226)
 #define CSP_8x11_DuplexCutPaper_F				(227)
 #define CSP_8x5_90_DuplexCutPaper_F			(228)
 #define CSP_8x5_90x2_DuplexCutPaper_F			(229)
 #define CSP_8x6_50_DuplexCutPaper_F			(230)
 #define CSP_8x10_DuplexCutPaper_F				(231)
 #define CSP_8x12_DuplexCutPaper_F				(232)
 #define CSP_8x4_DuplexCutPaper_F				(233)
 #define CSP_8x5_DuplexCutPaper_F				(234)
 #define CSP_8x6_DuplexCutPaper_F				(235)
 #define CSP_8x8_DuplexCutPaper_F				(236)
 #define CSP_8x4x2_DuplexCutPaper_F				(237)
 #define CSP_8x5x2_DuplexCutPaper_F				(238)
 #define CSP_8x6x2_DuplexCutPaper_F				(239)
 #define CSP_8xA4_DuplexCutPaper_F				(245)
 #define CSP_8x10_50_DuplexCutPaper_F			(251)
 #define CSP_8x10_75_DuplexCutPaper_F			(252)
 #define CSP_8x4x3_DuplexCutPaper_F				(253)
 #define CSP_8x7_24_DuplexCutPaper_F			(281)
 #define CSP_8x7_28_DuplexCutPaper_F			(282)
 #define CSP_8x11_30_DuplexCutPaper_F			(283)
 #define CSP_8x2_4Pieces_DuplexCutPaper_F		(284)
 #define CSP_8x2_5Pieces_DuplexCutPaper_F		(285)
 #define CSP_8x2_50_3Pieces_DuplexCutPaper_F	(286)
 #define CSP_8x2_50_4Pieces_DuplexCutPaper_F	(287)

/* Cut paper(Duplex print:Reverse side) */
 #define CSP_8x10_35_DuplexCutPaper_R			(325)
 #define CSP_8x7_10_DuplexCutPaper_R			(326)
 #define CSP_8x11_DuplexCutPaper_R				(327)
 #define CSP_8x5_90_DuplexCutPaper_R			(328)
 #define CSP_8x5_90x2_DuplexCutPaper_R			(329)
 #define CSP_8x6_50_DuplexCutPaper_R			(330)
 #define CSP_8x10_DuplexCutPaper_R				(331)
 #define CSP_8x12_DuplexCutPaper_R				(332)
 #define CSP_8x4_DuplexCutPaper_R				(333)
 #define CSP_8x5_DuplexCutPaper_R				(334)
 #define CSP_8x6_DuplexCutPaper_R				(335)
 #define CSP_8x8_DuplexCutPaper_R				(336)
 #define CSP_8x4x2_DuplexCutPaper_R				(337)
 #define CSP_8x5x2_DuplexCutPaper_R				(338)
 #define CSP_8x6x2_DuplexCutPaper_R				(339)
 #define CSP_8xA4_DuplexCutPaper_R				(345)
 #define CSP_8x10_50_DuplexCutPaper_R			(351)
 #define CSP_8x10_75_DuplexCutPaper_R			(352)
 #define CSP_8x4x3_DuplexCutPaper_R				(353)
 #define CSP_8x7_24_DuplexCutPaper_R			(381)
 #define CSP_8x7_28_DuplexCutPaper_R			(382)
 #define CSP_8x11_30_DuplexCutPaper_R			(383)
 #define CSP_8x2_4Pieces_DuplexCutPaper_R		(384)
 #define CSP_8x2_5Pieces_DuplexCutPaper_R		(385)
 #define CSP_8x2_50_3Pieces_DuplexCutPaper_R	(386)
 #define CSP_8x2_50_4Pieces_DuplexCutPaper_R	(387)
#endif	/* end DUPLEX */

/* Tower Error group -------------------*/

#define TGROUP_CXM0					(0x00000000)
#define TGROUP_CXM1					(0x00010000)
#define TGROUP_CXM2					(0x00020000)
#define TGROUP_CXM3					(0x00040000)
#define TGROUP_CXM4					(0x00080000)

/* CXM1 -------------------*/
#define STATUS_CXM_TOWER_NORMAL 	( TGROUP_CXM0 | 0x0000 )

#define STATUS_CXM_SHT_PJAM			( TGROUP_CXM1 | 0x0001 )
#define STATUS_CXM_SHT_PJAM_B		( TGROUP_CXM1 | 0x0002 )
#define STATUS_CXM_SHT_PJAM_A		( TGROUP_CXM1 | 0x0004 )
#define STATUS_CXM_SHT_PJAM_CORNER	( TGROUP_CXM1 | 0x0008 )


#define STATUS_CXM_SHT_COPEN		( TGROUP_CXM1 | 0x0010 )
#define STATUS_CXM_SHT_COPENA		( TGROUP_CXM1 | 0x0020 )
#define STATUS_CXM_SHT_COPENB		( TGROUP_CXM1 | 0x0040 )
#define STATUS_CXM_SHT_COPENC		( TGROUP_CXM1 | 0x0080 )
#define STATUS_CXM_SHT_COPEND		( TGROUP_CXM1 | 0x0100 )

#define STATUS_CXM_SHT_DOPEN		( TGROUP_CXM1 | 0x0200 )
#define STATUS_CXM_SHT_DOPENA		( TGROUP_CXM1 | 0x0400 )
#define STATUS_CXM_SHT_DOPENB		( TGROUP_CXM1 | 0x0800 )

#define STATUS_CXM_SHT_SYSERR		( TGROUP_CXM1 | 0x1000 )

#define STATUS_CXM_RS422_NONC		( TGROUP_CXM1 | 0x4000 )

#define STATUS_CXM_SHT_CORNER_OPEN	( TGROUP_CXM1 | 0x8000 )

/* CXM2 -------------------*/
#define STATUS_CXM_BP_PJAM			( TGROUP_CXM2 | 0x0001 )
#define STATUS_CXM_BP_PJAM_A		( TGROUP_CXM2 | 0x0002 )
#define STATUS_CXM_BP_PJAM_ABC		( TGROUP_CXM2 | 0x0004 )

#define STATUS_CXM_BP_DOPEN			( TGROUP_CXM2 | 0x0008 )
#define STATUS_CXM_BP_DOPENA		( TGROUP_CXM2 | 0x0010 )
#define STATUS_CXM_BP_DOPENB		( TGROUP_CXM2 | 0x0020 )
#define STATUS_CXM_BP_DOPENC		( TGROUP_CXM2 | 0x0040 )
#define STATUS_CXM_BP_DOPEND		( TGROUP_CXM2 | 0x0080 )

#define STATUS_CXM_BP_WDP			( TGROUP_CXM2 | 0x0100 )
#define STATUS_CXM_BP_DOPENE		( TGROUP_CXM2 | 0x0200 )


/* CXM3 -------------------*/
#define STATUS_CXM_SRT_SENSON		( TGROUP_CXM3 | 0x0001 )
#define STATUS_CXM_SRT_MAXERR		( TGROUP_CXM3 | 0x0002 )
#define STATUS_CXM_SRT_SYSERR		( TGROUP_CXM3 | 0x0004 )
#define STATUS_CXM_SRT_MOTERR		( TGROUP_CXM3 | 0x0008 )
#define STATUS_CXM_SRT_TIMEOUT		( TGROUP_CXM3 | 0x0010 )

/* CXM4 -------------------*/
#define STATUS_CXM_KIOSK_MODERR		( TGROUP_CXM4 | 0x0001 )
#define STATUS_CXM_BP_MODERR		( TGROUP_CXM4 | 0x0002 )

#define STATUS_CXM_TMP_MAXERR		( TGROUP_CXM4 | 0x0004 )
#define STATUS_CXM_TMP_GRPERR		( TGROUP_CXM4 | 0x0008 )


#define SERIAL_NUM_SET			(0x00000000)
#define SERIAL_NUM_FINAL		(0x00000001)

#define P_VOLT_100		(0)
#define P_VOLT_110		(1)
#define P_VOLT_120		(2)
#define P_VOLT_200		(3)
#define P_VOLT_220		(4)
#define P_VOLT_240		(5)

#define SORTER_MAX_OFF			(0)
#define SORTER_MAX_ON			(1)


#define SORTER_MOVE			(1)

#define BELTSRT_NOTMOVE		(0)
#define BELTSRT_MOVE		(1)

#define OUTPUT_DEST_AUTO		(0)	/* The automatic selection by the paper size */
#define OUTPUT_DEST_SORTER		(1)	/* Discharged to the sorter					 */
#define OUTPUT_DEST_TRAY		(2)	/* Discharged to the front tray				 */

#define MOT_CXM_SHT_A		(1)	/* Shooter motor A															*/
#define MOT_CXM_SHT_B		(2)	/* Shooter motor B															*/
#define MOT_CXM_BP			(3)	/* Back print unit motor													*/
#define MOT_CXM_SRT			(4)	/* Sorter motor																*/
#define MOT_CXM_FAN_A		(5)	/* Tower rear fan A															*/
#define MOT_CXM_FAN_B		(6)	/* Tower rear fan B															*/
#define SOL_CXM_OUTPUT		(7)	/* Solenoids used for the designation of the paper discharge destination	*/
/*------------------------*/

/* cutter mode settig value */
#define CUTTER_MODE_STANDARD		(0x00000000)	/* 0											*/
#define CUTTER_MODE_NONSCRAP		(0x00000001)	/* 1											*/
#define CUTTER_MODE_SINGLECUT		(0x00000002)	/* 2		DP-TC10 single cut					*/
#define CUTTER_MODE_NONSCRAP_1		(0x00000064)	/* 100		no cut-paper waste with all image	*/
#define CUTTER_MODE_NONSCRAP_2		(0x00000065)	/* 101		no cut-paper waste with first image	*/
#define CUTTER_MODE_NONSCRAP_3		(0x00000066)	/* 102		no cut-paper waste with last image	*/
#define CUTTER_MODE_2INCHCUT		(0x00000078)	/* 120		2inch cut both image				*/
#define CUTTER_MODE_2INCHCUT_2		(0x00000079)	/* 121		2inch cut first image				*/
#define CUTTER_MODE_2INCHCUT_3		(0x0000007A)	/* 122		2inch cut second image				*/
#define CUTTER_MODE_L2IMAGEPRINT	(0x00000082)	/* 130		DP-TC10 L width 2 image-layout		*/
#define CUTTER_MODE_PANORAMA		(0x000003E8)	/* 1000		panorama							*/

/* retention mode settig value */
#define RETENTION_MODE_OFF	(0)
#define RETENTION_MODE_ON	(1)

/* overcoat setting value */
#define OVERCOAT_FINISH_GLOSSY		(0)		/* Glossy							*/
#define OVERCOAT_FINISH_MATTE1		(1)		/* matte 1							*/
#define OVERCOAT_FINISH_PMATTE0		(10)	/* partial matte 0( pale )			*/
#define OVERCOAT_FINISH_PMATTE1		(11)	/* partial matte 1( slightly pale )	*/
#define OVERCOAT_FINISH_PMATTE2		(12)	/* partial matte 2( standrad )		*/
#define OVERCOAT_FINISH_PMATTE3		(13)	/* partial matte 3( slightly dark )	*/
#define OVERCOAT_FINISH_PMATTE4		(14)	/* partial matte 4( dark )			*/
#define OVERCOAT_FINISH_WATERMARK	(15)	/* partial matte ( water mark )		*/
#define OVERCOAT_FINISH_FINEMATTE	(21)	/* fine matte						*/
#define OVERCOAT_FINISH_LUSTER		(22)	/* luster							*/
#define OVERCOAT_FINISH_HSMATTE		(31)	/* light matte						*/
#define OVERCOAT_FINISH_PMATTE11	(101)	/* partial matte 11( matte )		*/
#define OVERCOAT_FINISH_PMATTE12	(121)	/* partial matte 12( fine matte )	*/
#define OVERCOAT_FINISH_PMATTE13	(122)	/* partial matte 13( luster )		*/

/* print re-try setting value */
#define PRINT_RETRY_OFF    (0)
#define PRINT_RETRY_ON	   (1) 

/* printer filter setting value */
#define PFILTER_OFF 	   (0)
#define PFILTER_ON		   (1)

/* return value of GetPanoramaPrintable() */
#define STATUS_PRINTABLE		(0x00000000)
#define STATUS_HIGHTEMP_HEAD	(0x00000001)
#define STATUS_HIGHTEMP_BOTH	(0x00000011)
#define STATUS_HIGHHUMIDITY		(0x00000100)
#define STATUS_LOWTEMP_MEDIA	(0x00000020)
#define STATUS_OTHER_STATE		(0x00010000)
#define STATUS_COMM_ERROR		(0xFFFFFFFF)

/* Continuous Panoramic Prints Specification */
#define CONT_PANORAMA_LAST		(0x00000000)
#define CONT_PANORAMA_PRINT		(0x00000001)

/* STS-XX value of GetDunitErrorLogStatus() */
#define STS_DUNIT_LOG_NO_DATA			(00)			/* error log data has not been created.				*/
#define STS_DUNIT_LOG_NOT_READY			(01)			/* error log data is currently being created.		*/
#define STS_DUNIT_LOG_READY				(02)			/* error log data creation has been completed.		*/
#define STS_DUNIT_LOG_ERROR				(99)			/* error occured.									*/

/* EXT-XXXXXXXX value of GetDunitErrorLogStatus() */
#define STS_DUNIT_LOG_TRNS_RDY_ERR		(00005401)		/* Data transfer preparation error.					*/
#define STS_DUNIT_LOG_LEN_RCV_ERR		(00005402)		/* Data transfer byte number of received error.		*/
#define STS_DUNIT_LOG_DATA_RCV_ERR		(00005403)		/* Data reception error.							*/
#define STS_DUNIT_LOG_OVERFLOW_ERR		(00005404)		/* Data overflow.									*/
#define STS_DUNIT_LOG_END_RCV_ERR		(00005405)		/* Data transfer completion code reception error.	*/
#define STS_DUNIT_LOG_MODE_END_ERR		(00005406)		/* Data transfer mode end error.					*/
#define STS_DUNIT_LOG_TIMEOUT_ERR		(00005407)		/* Data transfer time-out error.					*/
#define STS_DUNIT_LOG_OTHER_ERR			(00005420)		/* Other error										*/

/* baudrate value of DunitErrorLogCreateReq() */
#define LOG_BAUDRATE_038400			(0x00000000)
#define LOG_BAUDRATE_057600			(0x00000001)
#define LOG_BAUDRATE_115200			(0x00000002)

/* Print speed parameter */
#define PRINTSPEED_NORMAL			(0)	/* Normal printing (default)	 */
#define PRINTSPEED_HIGH_QUALITY		(2)	/* High quality printing		 */
#define PRINTSPEED_HIGH_DENSITY		(3)	/* High density printing		 */

/* Target media for Counter */
#define COUNT_ALL			(0)	/* for All Media	*/
#define COUNT_SD			(1)	/* for SD Media		*/
#define COUNT_PD			(2)	/* for PD Media		*/

/* Media Code for CWD */
#define CWD_RX1			(0x00000001)	/* for SD Media */
#define CWD_HQL			(0x00000002)	/* for PD Media */
#define CWD_HDM			(0x00000003)	/* for PP Media */

/* Cut control parameter */
#define CUT_MODE_STANDARD			(0)		/* sets standard cut operation mode(default)			*/
#define CUT_MODE_STICKER			(1)		/* sets Sticker Cutter Use Mode							*/
#define CUT_MODE_INSTRUCTION		(2)		/* sets Cut Designation Mode							*/
#define CUT_MODE_PAPER_FEED			(10)	/* Paper Feed designation (in Sticker Cutter Use)		*/
#define CUT_MODE_FEED_FORWARD		(100)	/* Paper Advance designation (in Sticker Cutter Use)	*/
#define CUT_MODE_FEED_BACKWARD		(200)	/* Paper Reverse designation (in Sticker Cutter Use)	*/
#define CUT_MODE_START_CUTTING		(1000)	/* Start Cutting directions								*/

/* lpState value of GetCutControlStatus() */
#define CUT_STS_IDLE					(0)		/* Cutting complete(idle)								*/
#define CUT_STS_PRINTING				(1)		/* Printing												*/
#define CUT_STS_WAIT_PAPER_FEED			(10)	/* Awaiting paper feed command or Feeding paper			*/
												/*	(When operating in Sticker Cutter Use Mode)			*/
#define CUT_STS_WAIT_COMMAND			(20)	/* Paper forwad/backward complete or Cutting			*/
												/*	(When operating in Sticker Cutter Use Mode)			*/
#define CUT_STS_FEED_FORWARD			(120)	/* Forward feed of the paper							*/
												/*	(When operating in Sticker Cutter Use Mode)			*/
#define CUT_STS_FEED_BACKWARD			(220)	/* Reverse feed of the paper							*/
												/*	(When operating in Sticker Cutter Use Mode)			*/
#define CUT_STS_WAIT_START_CUTTING		(1000)	/* Awaiting cut command or Feeding out/cutting			*/
												/*	(When operating in Cut Operation Mode)				*/
#define CUT_STS_ERROR					(9000)	/* Error has occurred									*/

/* media extension code */
#define EXT_CODE_STANDARD				("0000000000")		/* Standard paper		*/
#define EXT_CODE_STICKER				("0000000001")		/* Sticker paper		*/
#define EXT_CODE_UNKNOWN				("0000000099")		/* Unknown				*/

#define EXT_CODE_PERFORATION_1			("0000000100")		/* Perforation paper 1	*/
#define EXT_CODE_PERFORATION_2			("0000000200")		/* Perforation paper 2	*/
#define EXT_CODE_PERFORATION_3			("0000000300")		/* Perforation paper 3	*/
#define EXT_CODE_PERFORATION_4			("0000000400")		/* Perforation paper 4	*/
#define EXT_CODE_PERFORATION_5			("0000000500")		/* Perforation paper 5	*/
#define EXT_CODE_PERFORATION_6			("0000000600")		/* Perforation paper 6	*/
#define EXT_CODE_PERFORATION_7			("0000000700")		/* Perforation paper 7	*/
#define EXT_CODE_PERFORATION_8			("0000000800")		/* Perforation paper 8	*/
#define EXT_CODE_PERFORATION_9			("0000000900")		/* Perforation paper 9	*/

/* For CV Printers Item */

#define CVG_USUALLY					(0x00010000)
#define CVG_SETTING					(0x00020000)
#define CVG_HARDWARE				(0x00040000)
#define CVG_SYSTEM					(0x00080000)
#define CVG_FLSHPROG				(0x00100000)

#define CVSTATUS_ERROR				(0x80000000)
#define CVSTATUS_TIMEOUT			(0x80000001)

#define CVS_USUALLY_IDLE			( CVG_USUALLY | 0x0001 )
#define CVS_USUALLY_PRINTING		( CVG_USUALLY | 0x0002 )
#define CVS_USUALLY_STANDSTILL		( CVG_USUALLY | 0x0004 )
#define CVS_USUALLY_PAPER_END		( CVG_USUALLY | 0x0008 )
#define CVS_USUALLY_RIBBON_END		( CVG_USUALLY | 0x0010 )
#define CVS_USUALLY_COOLING			( CVG_USUALLY | 0x0020 )
#define CVS_USUALLY_MOTCOOLING		( CVG_USUALLY | 0x0040 )

#define CVS_SETTING_COVER_OPEN		( CVG_SETTING | 0x0001 )
#define CVS_SETTING_PAPER_JAM		( CVG_SETTING | 0x0002 )
#define CVS_SETTING_RIBBON_ERR		( CVG_SETTING | 0x0004 )
#define CVS_SETTING_PAPER_ERR		( CVG_SETTING | 0x0008 )
#define CVS_SETTING_DATA_ERR		( CVG_SETTING | 0x0010 )
#define CVS_SETTING_SCRAPBOX_ERR	( CVG_SETTING | 0x0020 )

#define CVS_HARDWARE_ERR01			( CVG_HARDWARE | 0x0001 )
#define CVS_HARDWARE_ERR02			( CVG_HARDWARE | 0x0002 )
#define CVS_HARDWARE_ERR03			( CVG_HARDWARE | 0x0004 )
#define CVS_HARDWARE_ERR04			( CVG_HARDWARE | 0x0008 )
#define CVS_HARDWARE_ERR05			( CVG_HARDWARE | 0x0010 )
#define CVS_HARDWARE_ERR06			( CVG_HARDWARE | 0x0020 )
#define CVS_HARDWARE_ERR07			( CVG_HARDWARE | 0x0040 )
#define CVS_HARDWARE_ERR08			( CVG_HARDWARE | 0x0080 )
#define CVS_HARDWARE_ERR09			( CVG_HARDWARE | 0x0100 )
#define CVS_HARDWARE_ERR10			( CVG_HARDWARE | 0x0200 )

#define CVS_SYSTEM_ERR01			( CVG_SYSTEM | 0x0001 )

#define CVS_FLSHPROG_IDLE			( CVG_FLSHPROG | 0x0001 )
#define CVS_FLSHPROG_WRITING		( CVG_FLSHPROG | 0x0002 )
#define CVS_FLSHPROG_FINISHED		( CVG_FLSHPROG | 0x0004 )
#define CVS_FLSHPROG_DATA_ERR1		( CVG_FLSHPROG | 0x0008 )
#define CVS_FLSHPROG_DEVICE_ERR1	( CVG_FLSHPROG | 0x0010 )
#define CVS_FLSHPROG_OTHERS_ERR1	( CVG_FLSHPROG | 0x0020 )

#ifdef __cplusplus
extern "C" {
#endif


long APIENTRY CvGetVersion( long lPortNum, LPSTR p );
long APIENTRY CvGetSensorInfo( long lPortNum, LPSTR p );
long APIENTRY CvGetStatus( long lPortNum );
long APIENTRY CvGetMedia( long lPortNum, LPSTR p );
long APIENTRY CvGetPQTY( long lPortNum );
long APIENTRY CvGetCounterL( long lPortNum );
long APIENTRY CvGetCounterA( long lPortNum );
long APIENTRY CvGetCounterB( long lPortNum );
BOOL APIENTRY CvSetClearCounterA( long lPortNum );
BOOL APIENTRY CvSetClearCounterB( long lPortNum );
long APIENTRY CvGetResolutionH( long lPortNum );
long APIENTRY CvGetResolutionV( long lPortNum );
long APIENTRY CvGetFreeBuffer( long lPortNum );
long APIENTRY CvGetMediaLotNo( long lPortNum, LPSTR p );
long APIENTRY CvGetMediaCounter( long lPortNum );
long APIENTRY CvGetMediaColorOffset( long lPortNum );

long APIENTRY CvGetSerialNo( long lPortNum, LPSTR p  );

BOOL APIENTRY CvSetCommand( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen );
BOOL APIENTRY CvGetCommand( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen , LPSTR lpRetBuff, DWORD dwRetBuffSize, LPDWORD lpdwRetLen) ;
long APIENTRY CvGetCommandEX( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen, LPSTR lpRetBuff, DWORD dwRetBuffSize );

BOOL APIENTRY CvSetFirmwUpdateMode( long lPortNum );
BOOL APIENTRY CvSetFirmwDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );
BOOL APIENTRY CvSetColorDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );

BOOL APIENTRY CvSetColorDataVersion( long lPortNum, LPSTR dBuff, DWORD bLen );
long APIENTRY CvGetColorDataVersion( long lPortNum, LPSTR p );
BOOL APIENTRY CvSetColorDataClear( long lPortNum );
long APIENTRY CvGetColorDataChecksum( long lPortNum, LPSTR p );

long APIENTRY GetFirmwVersion( long lPortNum, LPSTR p );
long APIENTRY GetSensorInfo( long lPortNum, LPSTR p );
long APIENTRY GetStatus( long lPortNum );
long APIENTRY GetMedia( long lPortNum, LPSTR p );
long APIENTRY GetPQTY( long lPortNum );
long APIENTRY GetCounterL( long lPortNum );
long APIENTRY GetCounterLifeEX( long lPortNum, DWORD dwMedia );
long APIENTRY GetCounterMatte( long lPortNum );
long APIENTRY GetCounterMatteEX( long lPortNum, DWORD dwMedia );
long APIENTRY GetCounterA( long lPortNum );
long APIENTRY GetCounterB( long lPortNum );
long APIENTRY GetCounterP( long lPortNum );
long APIENTRY GetCounterM( long lPortNum );

BOOL APIENTRY SetClearCounterA( long lPortNum );
BOOL APIENTRY SetClearCounterB( long lPortNum );
BOOL APIENTRY SetClearCounterM( long lPortNum );
BOOL APIENTRY SetCounterP( long lPortNum, long lCounter );

long APIENTRY GetResolutionH( long lPortNum );
long APIENTRY GetResolutionV( long lPortNum );
long APIENTRY GetFreeBuffer( long lPortNum );
long APIENTRY GetMediaLotNo( long lPortNum, LPSTR p );
long APIENTRY GetMediaCounter( long lPortNum );
long APIENTRY GetMediaColorOffset( long lPortNum );

BOOL APIENTRY SetColorDataVersion( long lPortNum, LPSTR dBuff, DWORD bLen );
long APIENTRY GetColorDataVersion( long lPortNum, LPSTR p );
BOOL APIENTRY SetColorDataClear( long lPortNum );
long APIENTRY GetColorDataChecksum( long lPortNum, LPSTR p );

long APIENTRY GetColorDataVersionRes( long lPortNum, LPSTR p, long resolution );
long APIENTRY GetColorDataVersionResEX( long lPortNum, LPSTR p, long lType, DWORD dwMedia );
long APIENTRY GetColorDataChecksumRes( long lPortNum, LPSTR p, long resolution );
long APIENTRY GetColorDataChecksumResEX( long lPortNum, LPSTR p, long lType, DWORD dwMedia );

BOOL APIENTRY SetCommand( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen );
long APIENTRY GetCommandEX( long lPortNum, LPSTR lpCmd, DWORD dwCmdLen, LPSTR lpRetBuff, DWORD dwRetBuffSize );

BOOL APIENTRY SetFirmwUpdateMode( long lPortNum );
BOOL APIENTRY SetFirmwDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );
BOOL APIENTRY SetColorDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );

BOOL APIENTRY SetColorDataWriteTmp( long lPortNum, LPSTR dBuff, DWORD bLen );
BOOL APIENTRY SetColorDataVersionTmp( long lPortNum, LPSTR dBuff, DWORD bLen );

BOOL APIENTRY SetCutterMode( long lPortNum, DWORD ctMode );
long APIENTRY GetMediaIdSetInfo( long lPortNum );
BOOL APIENTRY SetRetentionMode( long lPortNum, DWORD rtMode );
BOOL APIENTRY SetOvercoatFinish( long lPortNum, DWORD ovcoat );
BOOL APIENTRY SetRetryControl( long lPortNum, DWORD retry );

long APIENTRY GetPrinterPortNum(char *portArray, int size);
long APIENTRY SetPQTY(long lPortNum, long lpqty);
long APIENTRY SetMediaSize(long lPortNum, int lMedia);
long APIENTRY SendImageData(long lPortNum, LPSTR lpBuff,long lXPos, long lYPos, long lWidth, long lHeight);
long APIENTRY PrintImageData(long lPortNum);
long APIENTRY StartPageLayout(long lPortNum);
long APIENTRY EndPageLayout(long lPortNum);
long APIENTRY SetResolution(long lPortNum, int nResolution);

long APIENTRY GetSerialNo( long lPortNum, LPSTR p );

long APIENTRY GetMiniLabTowerStatus( long lPortNum );
BOOL APIENTRY SetMiniLabGroupNo( long lPortNum, long lGrNo);
BOOL APIENTRY SetMiniLabSerialNo( long lPortNum, long lSrNo, long lFinal);
BOOL APIENTRY SetMiniLabBackprintData( long lPortNum, LPSTR lpText, long lTextLen );
BOOL APIENTRY StopPrint( long lPortNum );
BOOL APIENTRY SetMiniLabBreakPrint( long lPortNum );
BOOL APIENTRY SetMiniLabOutputDest( long lPortNum, long lDest);
BOOL APIENTRY SetMiniLabPrinterAdd( long lPortNum, long lAddr );
long APIENTRY GetMiniLabPrinterAdd( long lPortNum );
BOOL APIENTRY SetMiniLabGroupNoIni( long lPortNum, long lGrNo, long lSrNo, long lOption);

BOOL APIENTRY SetMiniLabPowerVolt( long lPortNum, long lVolt);
BOOL APIENTRY SetMiniLabECurrentMax( long lPortNum, long lECMax);
BOOL APIENTRY SetMiniLabSrtSensor( long lPortNum, long lSense);

long APIENTRY GetMiniLabPowerVolt( long lPortNum );
long APIENTRY GetMiniLabECurrentMax( long lPortNum );
long APIENTRY GetMiniLabSrtSensor( long lPortNum );

long APIENTRY GetMiniLabGroupNo( long lPortNum );
long APIENTRY GetMiniLabSerialNo( long lPortNum );

long APIENTRY GetMiniLabECurrentP( long lPortNum );
long APIENTRY GetMiniLabECurrentT( long lPortNum );


long APIENTRY SetMiniLabStartDiagMode( long lPortNum );
long APIENTRY SetMiniLabEndDiagMode( long lPortNum );
long APIENTRY SetMiniLabMotorOp( long lPortNum, long lMot );
long APIENTRY GetMiniLabSensorInfo( long lPortNum, LPSTR p );
long APIENTRY GetMiniLabMotorStatus( long lPortNum, LPSTR p );
long APIENTRY SetMiniLabShootRestart( long lPortNum, long lBelt );

long APIENTRY GetRfidMediaClass( long lPortNum, LPSTR p );
long APIENTRY GetRfidReserveData( long lPortNum, LPSTR p, DWORD dwPage );
long APIENTRY GetInitialMediaCount( long lPortNum );

long APIENTRY SetUSBTimeout(long lPortNum, long time);
long APIENTRY SetPrinterFilter(long sw );

#ifdef DUPLEX
long APIENTRY SetDuplexBreakPoint(long lPortNum, long ecode );
long APIENTRY GetDunitStatus( long lPortNum );
long APIENTRY GetCutPaper( long lPortNum, LPSTR p  );
long APIENTRY SetCutPaper( long lPortNum, long lCutPaper  );
long APIENTRY GetDunitUpdateStatus( long lPortNum, LPSTR p );
BOOL APIENTRY SetDunitFirmwUpdateMode( long lPortNum, DWORD baudrate );
BOOL APIENTRY SetDunitFirmwDataWrite( long lPortNum, LPSTR dBuff, DWORD bLen );
#endif	/* end DUPLEX */

#ifdef DUPLEX_COUNTER
long APIENTRY GetCounterDuplex( long lPortNum );
BOOL APIENTRY SetCancelDuplexPrint( long lPortNum );
long APIENTRY GetVersionDuplex( long lPortNum, LPSTR p );
#endif	/* end DUPLEX_COUNTER */

long APIENTRY SetFullCutterSetUp( long lPortNum, long lCutSize1,long lCutSize2,long lCutSize3,long lCutSize4 );
long APIENTRY SetFullCutterSetUpEX( long lPortNum, long lCutNum, long lDustSize, long lCutSize1, ... );
long APIENTRY SetStandbyTime( long lPortNum,long lTime );
long APIENTRY GetStandbyTime( long lPortNum );
long APIENTRY SetEndKeepMode( long lPortNum, long lMode );
long APIENTRY GetEndKeepMode ( long lPortNum );
long APIENTRY GetMediaCounterH( long lPortNum );
long APIENTRY SetUSBSerialEnable( long lPortNum, long dwEnable );
long APIENTRY GetUSBSerialEnable( long lPortNum );
long APIENTRY SetRewindMode( long lPortNum, long lRewind );
long APIENTRY GetRewindMode( long lPortNum );

DWORD APIENTRY GetPanoramaPrintable( long lPortNum );

#ifdef DUPLEX
BOOL APIENTRY DunitErrorLogCreateReq( long lPortNum, DWORD dwBaudRate );
long APIENTRY GetDunitErrorLogDataLength( long lPortNum );
long APIENTRY GetDunitErrorLogData( long lPortNum, LPSTR lpData, DWORD dwBufSize);
long APIENTRY GetDunitErrorLogStatus( long lPortNum, LPSTR p, DWORD dwBufSize);
#endif	/* end DUPLEX */

long APIENTRY GetMediaCountOffset( long lPortNum );

BOOL APIENTRY SetContPanorama( long lPortNum, DWORD dwContinuous, DWORD dwOverlap );

BOOL APIENTRY SetPrintSpeed( long lPortNum, long lPrintSpeed );

long APIENTRY GetMediaExtensionCode( long lPortNum, LPSTR p );
BOOL APIENTRY SetCutControl( long lPortNum, DWORD dwMode, DWORD dwSpeed, DWORD dwLength );
BOOL APIENTRY SetPaperFeed( long lPortNum, DWORD dwFrontFeed, DWORD dwRearFeed, DWORD dwFlag );
BOOL APIENTRY GetCutControlStatus( long lPortNum, LPDWORD lpState, LPDWORD lpFeedCount, LPDWORD lpRemainLength );

BOOL APIENTRY SetGammaTable( long lPortNum, LPBYTE lpGammaTable, long lDataLen );
long APIENTRY GetGammaTableChecksum( long lPortNum, LPSTR p );
BOOL APIENTRY SetDataTableClear( long lPortNum );

#ifdef DUPLEX
DWORD APIENTRY GetExtensionStatus( long lPortNum );
#endif	/* end DUPLEX */

long APIENTRY GetHalfcutDesignInfo( long lPortNum, char cKind );
BOOL APIENTRY SetHalfcutPrintPos( long lPortNum, long lXOffset, long lYOffset );

BOOL APIENTRY SetDecurlCtrl( long lPortNum, WORD wMode );
BOOL APIENTRY SetSysTime( long lPortNum, LPSTR lpSystemTime );

long APIENTRY GetSupportedMediaInfo( long lPortNum, LPSTR p );

long APIENTRY GetNumOfErrorLogData( long lPortNum );
long APIENTRY GetErrorLogData( long lPortNum, DWORD dwNum, LPSTR lpData, DWORD dwBufSize );

#ifdef DUPLEX
BOOL APIENTRY SetCreaseLine( long lPortNum, WORD wNumOfCreaseLine, WORD wNumOfPerPos, WORD wPitchOfPerPos, WORD wPosOfCreaseLine[] );
BOOL APIENTRY SetSlitterCtrl( long lPortNum, WORD wPos );
BOOL APIENTRY SetCreaserUnitDisable( long lPortNum, DWORD dwDisable );
long APIENTRY GetCreaserUnitDisable( long lPortNum );
BOOL APIENTRY SetSlitterUnitDisable( long lPortNum, DWORD dwDisable );
long APIENTRY GetSlitterUnitDisable( long lPortNum );

BOOL APIENTRY SetPreventBandUnevenness( long lPortNum, DWORD dwEnable );

BOOL APIENTRY SetRibbonChangeAfterMode( long lPortNum, DWORD dwMode );
long APIENTRY GetRibbonChangeAfterMode( long lPortNum );
BOOL APIENTRY SetPrinterRestart( long lPortNum );

#endif	/* end DUPLEX */

#ifdef __cplusplus
}
#endif

#endif	/* end _CSPSTAT_H_ */