import { ConciergeTicket } from '../types';

/**
 * AIコンシェルジュ・チケット報酬システムの共通定数と基本ロジック
 */
export const CONCIERGE_CAMPAIGN = {
  START_DATE: '2026-01-01',
  END_DATE: '2026-04-30',
  DAILY_EXPIRATION_DAYS: 30,
  CONTRIBUTION_EXPIRATION_DAYS: 30,
};

export class BaseAiConciergeService {
  /**
   * 現在がキャンペーン期間中か判定
   */
  isCampaignPeriod(): boolean {
    const now = new Date();
    const start = new Date(CONCIERGE_CAMPAIGN.START_DATE);
    const end = new Date(CONCIERGE_CAMPAIGN.END_DATE);
    return now >= start && now <= end;
  }

  /**
   * 付与日時と有効期限（ISO8601）を計算
   */
  calculateExpirations(days: number): { grantedAt: string; expiresAt: string } {
    const now = new Date();
    const grantedAt = now.toISOString();
    const expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      grantedAt,
      expiresAt: expirationDate.toISOString(),
    };
  }

  /**
   * チケットドキュメントの初期化（共通ヘルパー）
   */
  createTicketBase(params: {
    id: string;
    type: ConciergeTicket['type'];
    count: number;
    reason: string;
    expirationDays: number;
  }): ConciergeTicket {
    const { grantedAt, expiresAt } = this.calculateExpirations(params.expirationDays);
    return {
      id: params.id,
      type: params.type,
      count: params.count,
      remainingCount: params.count,
      grantedAt,
      expiresAt,
      status: 'active',
      reason: params.reason,
    };
  }
}
