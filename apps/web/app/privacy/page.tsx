'use client';

import { useT } from '../../lib/i18n/context';
import { DocLayout, H2 } from '../../components/DocLayout';

const LAST_UPDATED = '2026-04-18';

export default function PrivacyPage() {
  const t = useT();
  return (
    <DocLayout title={t('privacy.title')}>
      <p className="text-xs text-muted-foreground">
        {t('terms.lastUpdated', { date: LAST_UPDATED })}
      </p>

      <H2>1. 我们收集什么</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>账号信息</strong>：注册邮箱、密码（argon2 不可逆哈希）、角色</li>
        <li><strong>API 用量</strong>：每次请求的模型名、输入 / 输出 token 数、延迟、HTTP 状态码、成本</li>
        <li><strong>余额 / 交易</strong>：当前余额、累计消费、卡密兑换记录</li>
        <li><strong>审计日志</strong>：管理员对你账号的操作（创建、删除、充值、改密等）</li>
        <li><strong>IP / User-Agent</strong>：Fastify 默认记录请求头，用于限流和审计</li>
      </ul>

      <H2>2. 我们不收集什么</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <strong>你发送给模型的 prompt 内容</strong>：不落盘。只路径过本站 relay 层的内存，
          转发完即丢弃。数据库 <code>usage_log</code> 表只有 token <em>数量</em>，没有内容
        </li>
        <li>
          <strong>模型返回的内容</strong>：同样不存。流式响应是 byte-for-byte 透传给客户端
        </li>
        <li>
          <strong>文件 / 图片</strong>：目前不支持多模态输入，相关功能未实装
        </li>
      </ul>

      <H2>3. 数据会被传递给谁</H2>
      <p>
        你的 prompt 会通过 HTTPS 转发给上游供应商（Anthropic 或 OpenAI）。
        **他们**会根据自己的隐私政策处理这些内容。我们**不能**代替他们保证隐私 —— 请参考：
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <a
            href="https://www.anthropic.com/legal/privacy"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Anthropic Privacy Policy
          </a>
        </li>
        <li>
          <a
            href="https://openai.com/policies/privacy-policy"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenAI Privacy Policy
          </a>
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">
        我们使用的是 OAuth 订阅账号，上游的"不使用 API 数据训练模型"承诺在这条链路上是否
        继续有效，我们**不能代为保证**。敏感内容请勿走本站。
      </p>

      <H2>4. 数据保留期</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>账号信息 —— 直到你请求销号</li>
        <li>用量日志（<code>usage_log</code>）—— 90 天后自动轮滚</li>
        <li>审计日志（<code>audit_log</code>）—— 365 天</li>
        <li>兑换记录 —— 和账号同寿命</li>
      </ul>

      <H2>5. 数据安全</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>全站强制 HTTPS（TLS 1.3）</li>
        <li>密码以 argon2id 哈希存储，原密码从不入库</li>
        <li>上游 OAuth token 用 AES-256-GCM 加密存数据库，密钥不在数据库里</li>
        <li>API Key 只存 SHA-256 哈希，明文仅铸造时一次性返回</li>
        <li>会话用 httpOnly + secure + sameSite=lax 的 cookie</li>
      </ul>

      <H2>6. 你的权利</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>查看自己的所有数据（控制台可见）</li>
        <li>修改密码（控制台 → 设置）</li>
        <li>撤销自己的 API Key（控制台 → API 密钥）</li>
        <li>请求销号（联系管理员）—— 销号会硬删 users 表行 + 解除所有 api_keys 关联</li>
      </ul>

      <H2>7. Cookie</H2>
      <p>
        仅使用一个 <code>xxf_admin_session</code> cookie 存登录 JWT，用途仅限身份验证。
        无第三方追踪、无广告 cookie。
      </p>

      <H2>8. 儿童</H2>
      <p>
        本站服务**不面向 18 岁以下用户**。如发现未成年人账号会立即删除。
      </p>

      <H2>9. 变更通知</H2>
      <p>
        隐私政策变更会在页面顶部更新 "Last updated" 日期，重大变更会以邮件通知。
      </p>
    </DocLayout>
  );
}
