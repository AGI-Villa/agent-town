'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface TrendData {
  date: string;
  tokens: number;
  cost: number;
}

interface AgentData {
  agent_id: string;
  tokens: number;
  cost: number;
}

const COLORS = ['#29adff', '#00e436', '#ffec27', '#ff004d', '#ff77a8', '#ffa300', '#83769c', '#5f574f'];

export function TokenTrendChart({ data }: { data: TrendData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#83769c] font-pixel text-xs">
        暂无数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#5f574f" />
        <XAxis
          dataKey="date"
          stroke="#83769c"
          tick={{ fill: '#c2c3c7', fontSize: 10 }}
          tickFormatter={(value) => value.slice(5)}
        />
        <YAxis
          stroke="#83769c"
          tick={{ fill: '#c2c3c7', fontSize: 10 }}
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value;
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1d2b53',
            border: '2px solid #5f574f',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
          labelStyle={{ color: '#fff1e8' }}
          formatter={(value) => [Number(value).toLocaleString(), 'Tokens']}
        />
        <Line
          type="monotone"
          dataKey="tokens"
          stroke="#29adff"
          strokeWidth={2}
          dot={{ fill: '#29adff', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: '#fff1e8' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AgentDistributionChart({ data }: { data: AgentData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#83769c] font-pixel text-xs">
        暂无数据
      </div>
    );
  }

  const chartData = data.slice(0, 8).map((item) => ({
    name: item.agent_id,
    value: item.tokens,
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) =>
            (percent ?? 0) > 0.05 ? `${(name ?? '').slice(0, 8)}` : ''
          }
          labelLine={false}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1d2b53',
            border: '2px solid #5f574f',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
          formatter={(value) => [Number(value).toLocaleString(), 'Tokens']}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }}
          formatter={(value) => <span style={{ color: '#c2c3c7' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AgentRankingList({ data }: { data: AgentData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-[#83769c] font-pixel text-xs py-4">
        暂无数据
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.slice(0, 10).map((agent, index) => (
        <div
          key={agent.agent_id}
          className="flex items-center gap-2 bg-[#000]/20 p-2 rounded border border-[#5f574f]/50"
        >
          <span
            className="font-pixel text-xs w-6 h-6 flex items-center justify-center rounded"
            style={{
              backgroundColor: index < 3 ? COLORS[index] : '#5f574f',
              color: index < 3 ? '#000' : '#c2c3c7',
            }}
          >
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-pixel text-xs text-[#fff1e8] truncate">
              {agent.agent_id}
            </div>
            <div className="font-pixel text-[8px] text-[#83769c]">
              ${agent.cost.toFixed(4)}
            </div>
          </div>
          <div className="font-pixel text-xs text-[#29adff]">
            {agent.tokens >= 1000000
              ? `${(agent.tokens / 1000000).toFixed(1)}M`
              : agent.tokens >= 1000
              ? `${(agent.tokens / 1000).toFixed(0)}K`
              : agent.tokens}
          </div>
        </div>
      ))}
    </div>
  );
}
