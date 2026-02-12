import { useState } from "react";
import { AlertCircle, TrendingUp, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { ExecutionResponse, ChartRecommendation } from "@/types/query";

interface ChartRecommendationProps {
  executionResult: ExecutionResponse;
  onAcceptChart: (recommendation: ChartRecommendation) => void;
  onReject?: () => void;
}

export const ChartRecommendationComponent = ({
  executionResult,
  onAcceptChart,
  onReject,
}: ChartRecommendationProps) => {
  const [recommendation] = useState<ChartRecommendation>(
    executionResult.recommendation
  );
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      onAcceptChart(recommendation);
    } finally {
      setIsAccepting(false);
    }
  };

  const getChartIcon = (type: string) => {
    const icons: Record<string, string> = {
      bar: "📊",
      line: "📈",
      scatter: "📍",
      pie: "🥧",
      area: "📉",
      histogram: "📐",
      column: "📋",
    };
    return icons[type] || "📊";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="shadow-card border-accent/50">
        <CardHeader className="bg-gradient-to-r from-accent/10 to-accent/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              Recomendação de Gráfico
            </CardTitle>
            <Badge variant="secondary" className="text-accent">
              {executionResult.execution_time_ms.toFixed(2)}ms
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="p-4 border-2 border-accent/50 rounded-lg bg-accent/5">
              <div className="text-3xl text-center mb-2">
                {getChartIcon(recommendation.chart_type)}
              </div>
              <h3 className="text-center font-semibold text-sm text-accent">
                {recommendation.chart_type.toUpperCase()}
              </h3>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-2">Campo X</div>
              <div className="font-medium text-sm truncate">
                {recommendation.x_field}
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-2">Campo Y</div>
              <div className="font-medium text-sm truncate">
                {recommendation.y_field}
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-2">Registros</div>
              <div className="font-medium text-sm">
                {executionResult.result.row_count}
              </div>
            </div>
          </div>
<div className="space-y-3 border-t pt-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Título Sugerido</h4>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="font-medium">{recommendation.title}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Motivo da Recomendação</h4>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{recommendation.reason}</AlertDescription>
              </Alert>
            </div>

            {recommendation.configuration && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Configuração</h4>
                <div className="p-3 bg-muted/30 rounded-lg text-xs font-mono space-y-1">
                  {Object.entries(recommendation.configuration).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-muted-foreground">{key}:</span>{" "}
                      <span className="text-primary">
                        {typeof value === "string" ? `"${value}"` : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
<div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Dados Processados</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground">Total de Colunas:</span>
                <span className="ml-2 font-medium">
                  {executionResult.result.columns.length}
                </span>
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground">Total de Linhas:</span>
                <span className="ml-2 font-medium">
                  {executionResult.result.row_count}
                </span>
              </div>
            </div>
            <div className="mt-2 p-2 bg-muted/30 rounded text-sm">
              <span className="text-muted-foreground">Colunas:</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {executionResult.result.columns.map((col) => (
                  <Badge key={col} variant="outline" className="text-xs">
                    {col}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
<div className="border-t pt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={onReject}
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Tentar Outro
            </Button>
            <Button
              className="flex-1 bg-gradient-primary hover:shadow-glow"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {isAccepting ? "Gerando..." : "Aceitar & Gerar Gráfico"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

