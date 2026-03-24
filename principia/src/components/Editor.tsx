
interface EditorProps {
  value: string;
  onChange: (val: string) => void;
  lang: 'en' | 'zh';
}

export function Editor({ value, onChange, lang }: EditorProps) {
  const placeholder = lang === 'en' ? 
    "# Newtonian Mechanics\n\nConsider a particle of mass $m$ moving under the influence of a potential $V(x)$. \nThe Lagrangian is given by:\n\n$$ L = T - V = \\frac{1}{2}m\\dot{x}^2 - V(x) $$\n\nThe equation of motion is derived from Euler-Lagrange equation..."
    :
    "# 牛顿力学\n\n考虑一个质量为 $m$ 的粒子在势场 $V(x)$ 作用下运动。\n拉格朗日量为：\n\n$$ L = T - V = \\frac{1}{2}m\\dot{x}^2 - V(x) $$\n\n运动方程由欧拉-拉格朗日方程推导...";

  return (
    <div className="h-full w-full bg-background p-8 flex flex-col border-r border-border">
      <div className="mb-4 flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest font-semibold">
        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        {lang === 'en' ? 'Source Input' : '源输入'}
      </div>
      <textarea
        className="w-full h-full bg-transparent text-foreground resize-none outline-none font-mono text-sm leading-7 placeholder:text-muted-foreground/50 custom-scrollbar overflow-y-auto"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
