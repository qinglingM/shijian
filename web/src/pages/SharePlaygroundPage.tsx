import { BackHeader } from '@/components/layout/AppLayout'

export function SharePlaygroundPage() {
  const dummyRestaurant = {
    name: '老王家地道肠粉',
    category: '街头小吃',
    address: '广州市天河区 · 体育西路123号',
    tier: 'top',
    cover: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=500&h=500&fit=crop',
  }

  const dummyReview = {
    nickname: '挑嘴大王',
    content: '绝了！这肠粉滑得像我刚剥壳的鸡蛋，配上特制酱油简直能再干两碟！排队半小时也值了！',
    date: '2026-05-20',
  }

  const QRPlaceholder = () => (
    <div className="size-14 shrink-0 rounded-md bg-neutral-900 p-1 flex flex-wrap gap-0.5 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-white px-1 py-0.5 rounded-sm text-[8px] font-bold text-black z-10">食鉴</div>
      </div>
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className={`w-[30%] h-[30%] ${Math.random() > 0.5 ? 'bg-white' : 'bg-transparent'}`} />
      ))}
    </div>
  )

  return (
    <>
      <BackHeader title="分享海报方案预览" />
      <div className="min-h-screen bg-neutral-100 p-4 pb-24 space-y-12">
        
        {/* 方案一：高级画报风 */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-neutral-800 px-2">方案一：高级画报风 (Premium)</h2>
          <div className="mx-auto w-[320px] overflow-hidden rounded-[24px] bg-white shadow-xl">
            {/* 上半部分：封面图 */}
            <div className="relative h-64 w-full">
              <img src={dummyRestaurant.cover} alt="" className="size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">顶级</span>
                  <span className="text-xs font-bold text-neutral-700/80">{dummyRestaurant.category}</span>
                </div>
                <h1 className="text-2xl font-black text-neutral-900 tracking-tight leading-tight shadow-white drop-shadow-md">
                  {dummyRestaurant.name}
                </h1>
                <p className="mt-1 text-xs text-neutral-600 font-medium drop-shadow-md">{dummyRestaurant.address}</p>
              </div>
            </div>

            {/* 中部：锐评卡片 */}
            <div className="px-5 pb-6 pt-2">
              <div className="relative rounded-2xl bg-neutral-50 p-4 shadow-sm border border-neutral-100/50">
                <div className="absolute -left-2 -top-4 text-6xl font-black text-orange-200 opacity-60 leading-none">“</div>
                <p className="relative z-10 text-[14px] leading-relaxed text-neutral-800 font-medium">
                  {dummyReview.content}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="size-5 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">挑</div>
                  <span className="text-[11px] font-bold text-neutral-500">@{dummyReview.nickname} 的真实食鉴</span>
                </div>
              </div>
            </div>

            {/* 底部 Footer */}
            <div className="flex items-center justify-between border-t border-neutral-100 bg-white px-5 py-4">
              <div className="flex-1 pr-3">
                <p className="text-[13px] font-bold text-neutral-800">长按扫码，看更多排雷报告</p>
                <p className="mt-0.5 text-[10px] text-neutral-400 font-medium">食鉴 - 拒绝被坑的真实餐饮指南</p>
              </div>
              <QRPlaceholder />
            </div>
          </div>
        </section>

        {/* 方案二：情绪小票风 */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-neutral-800 px-2">方案二：情绪小票风 (Receipt)</h2>
          <div className="mx-auto w-[320px] shadow-lg relative" style={{ filter: 'drop-shadow(0 10px 8px rgb(0 0 0 / 0.04))' }}>
            {/* 顶部锯齿 */}
            <div className="h-3 w-full bg-neutral-50 bg-[radial-gradient(circle_at_4px_0px,transparent_4px,white_4px)] bg-[length:12px_12px]" style={{ backgroundPosition: 'center bottom' }}></div>
            
            <div className="bg-neutral-50 px-6 py-8 relative">
              <div className="text-center">
                <h3 className="text-lg font-black tracking-widest text-neutral-900 border-b-2 border-neutral-900 pb-2 inline-block">食鉴真实鉴定单</h3>
              </div>
              
              <div className="mt-6 space-y-1.5 text-[13px] font-mono font-medium text-neutral-700">
                <div className="flex justify-between">
                  <span>店铺</span>
                  <span className="font-bold text-neutral-900 text-right max-w-[60%] truncate">{dummyRestaurant.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>品类</span>
                  <span>{dummyRestaurant.category}</span>
                </div>
                <div className="flex justify-between">
                  <span>等级</span>
                  <span className="font-bold text-neutral-900">顶级</span>
                </div>
                <div className="flex justify-between">
                  <span>鉴定日</span>
                  <span>{dummyReview.date}</span>
                </div>
              </div>

              <div className="my-6 border-t-[2px] border-dashed border-neutral-300"></div>

              <div className="relative">
                <p className="text-[15px] font-bold leading-relaxed text-neutral-800 font-serif italic">
                  "{dummyReview.content}"
                </p>
                <p className="mt-3 text-right text-[11px] font-mono text-neutral-500">
                  —— @{dummyReview.nickname}
                </p>
              </div>

              <div className="my-6 border-t-[2px] border-dashed border-neutral-300"></div>

              <div className="flex items-center gap-4">
                <QRPlaceholder />
                <div className="font-mono text-[11px] text-neutral-600 space-y-1">
                  <p className="font-bold text-neutral-900 text-[12px]">拒绝被坑，扫码查验</p>
                  <p>SHIJIAN APP</p>
                </div>
              </div>
            </div>

            {/* 底部锯齿 */}
            <div className="h-3 w-full bg-neutral-50 bg-[radial-gradient(circle_at_4px_12px,transparent_4px,white_4px)] bg-[length:12px_12px]" style={{ backgroundPosition: 'center top' }}></div>
          </div>
        </section>

        {/* 方案三：态度徽章风 */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-neutral-800 px-2">方案三：态度徽章风 (Badge)</h2>
          <div className="mx-auto w-[320px] overflow-hidden rounded-[24px] bg-[#e39032] shadow-xl relative px-5 py-8">
            {/* 装饰水印 */}
            <div className="absolute -right-8 -top-8 rotate-12 opacity-10 font-black text-9xl pointer-events-none text-white">
              TOP
            </div>

            <div className="relative z-10">
              {/* 印章 */}
              <div className="mx-auto mb-6 flex size-28 items-center justify-center rounded-full border-4 border-white/90 bg-white shadow-xl rotate-[-5deg]">
                <div className="text-center">
                  <div className="text-[10px] font-black tracking-widest text-[#e39032]">食鉴认证</div>
                  <div className="text-3xl font-black text-[#e39032] mt-0.5">顶级</div>
                </div>
              </div>

              <div className="text-center text-white mb-8">
                <h1 className="text-2xl font-black tracking-tight">{dummyRestaurant.name}</h1>
                <p className="mt-1.5 text-[12px] font-medium opacity-90">{dummyRestaurant.address}</p>
              </div>

              {/* 气泡锐评 */}
              <div className="relative rounded-2xl bg-white p-4 shadow-lg text-neutral-900 mt-2">
                <div className="absolute -top-3 left-1/2 -ml-3 border-b-[12px] border-l-[10px] border-r-[10px] border-b-white border-l-transparent border-r-transparent"></div>
                <p className="text-[14px] leading-relaxed font-bold">
                  "{dummyReview.content}"
                </p>
                <div className="mt-2 text-right text-[11px] font-bold text-[#e39032]">
                  @{dummyReview.nickname}
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-8 flex items-center justify-between rounded-xl bg-black/10 p-3 backdrop-blur-sm">
              <div className="text-white">
                <p className="text-[14px] font-black">扫码看真相</p>
                <p className="text-[10px] opacity-80 mt-0.5">食鉴 APP</p>
              </div>
              <div className="bg-white p-1 rounded-lg">
                <QRPlaceholder />
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  )
}
