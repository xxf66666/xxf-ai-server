'use client';

import { useT } from '../../lib/i18n/context';
import { DocLayout, H2 } from '../../components/DocLayout';

const LAST_UPDATED = '2026-04-18';

export default function TermsPage() {
  const t = useT();
  const { locale } = { locale: 'zh' as 'zh' | 'en' }; // dict-driven below, but keep explicit for SSR

  return (
    <DocLayout title={t('terms.title')}>
      <p className="text-xs text-muted-foreground">
        {t('terms.lastUpdated', { date: LAST_UPDATED })}
      </p>

      <H2>1. 服务概述</H2>
      <p>
        Nexa（"本站"）是一个独立运营的 AI API 网关，把 Anthropic Claude 和 OpenAI
        的订阅账号资源聚合后，以按 token 计费的方式对注册用户提供统一 API 服务。
        <strong>本站非 Anthropic、非 OpenAI 的官方服务</strong>，也未获得它们的商业合作或背书。
      </p>

      <H2>2. 使用前提</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>用户需通过管理员分发的**邀请码**注册账号，自主开通不可用</li>
        <li>用户需遵守所在国家 / 地区的相关法律法规</li>
        <li>不得用于违法用途、生成非法内容、侵犯他人权益</li>
        <li>不得滥用 API 恶意消耗他人余额（本站默认只有账号所有者能用自己的 key）</li>
      </ul>

      <H2>3. 计费与退款</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>按 token 计费，精度到 10⁻⁶ USD，具体价目见 <a className="text-primary hover:underline" href="/pricing">/pricing</a></li>
        <li>新注册用户自动获得 **$5** 体验额度</li>
        <li>充值通过管理员分发的**卡密**完成 —— 卡密面额即为充值金额</li>
        <li>
          <strong>已消费的余额不退</strong>。未消费余额原则上可退，但本站当前**不支持自动退款**；
          特殊情况请联系管理员沟通
        </li>
        <li>
          上游（Anthropic / OpenAI）发生封禁、限流等不可控情况时，本站保留暂停服务的权利，
          未消费余额可迁移或冻结
        </li>
      </ul>

      <H2>4. 服务质量</H2>
      <p>
        本站按<strong>"尽力而为"</strong>提供服务，不保证：
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>100% 在线时间（上游故障时本站亦可能 503）</li>
        <li>响应延迟在任意水平（跨洲网络不可控）</li>
        <li>模型行为完全和官方一致（上游可能随时改版）</li>
      </ul>
      <p>
        本站的核心指标（请求成功率、延迟）公开在{' '}
        <code>/metrics</code> 端点，用户可自行监控。
      </p>

      <H2>5. 账号封禁</H2>
      <p>以下情况管理员有权封禁账号，已消费余额不退：</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>刷单 / 异常高频调用影响其他用户</li>
        <li>疑似账号外借或共享</li>
        <li>用于违反 Anthropic / OpenAI 上游 AUP 的请求（色情、未成年、违规模型滥用等）</li>
        <li>其他经审慎判断确有恶意的行为</li>
      </ul>

      <H2>6. 免责</H2>
      <p>
        上游供应商（Anthropic / OpenAI）的服务条款、AUP、模型能力、价格都可能变化，本站
        不对此承担连带责任。
      </p>
      <p>
        用户知悉并同意：使用本站服务的所有回复内容都源自上游大模型，可能包含不准确、过时或
        虚构的信息。**重要决策请独立核实**。
      </p>

      <H2>7. 修改与终止</H2>
      <p>
        本协议条款可能不定期更新，更新后会在页面顶部标注日期。继续使用本站即视为接受新版本。
        如不同意可随时停止使用并请求销号。
      </p>

      <H2>8. 联系</H2>
      <p>
        有问题请通过**注册邀请码时提供的联系方式**（微信 / Telegram / 邮件）联系管理员。
      </p>
    </DocLayout>
  );
}
