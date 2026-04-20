import { useState } from "react";
import { AlertCircle, TrendingUp, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import type { ExecutionResponse, ChartRecommendation } from "@/types/query";
import type { DataValue } from "@/types/chart";
import { ChartRenderer } from "@/components/ChartRenderer";
import { getChartModel } from "@/models/ChartRegistry";
import { normalizeChartType } from "@/types/chart";

interface ChartRecommendationProps {
  executionResult: ExecutionResponse;
  onAcceptChart: (recommendation: ChartRecommendation) => void;
  onReject?: () => void;
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const ChartRecommendationComponent = ({
  executionResult,
  onAcceptChart,
  onReject,
}: ChartRecommendationProps) => {
  const [recommendation, setRecommendation] = useState<ChartRecommendation>(
    executionResult.recommendation
  );
  const [isAccepting, setIsAccepting] = useState(false);

  const normalizedType = normalizeChartType(recommendation.chart_type);
  const model = getChartModel(normalizedType);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      onAcceptChart(recommendation);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSelectAlternative = (chartType: string) => {
    setRecommendation((prev) => ({
      ...prev,
      chart_type: chartType,
      reason: `Alternativa selecionada manualmente`,
    }));
  };

  const previewData = executionResult.result.data.slice(0, 30) as Array<
    Record<string, DataValue>
  >;
  const columns = executionResult.result.columns;

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
          {/* Tipo principal + campos */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="p-4 border-2 border-accent/50 rounded-lg bg-accent/5 flex flex-col items-center justify-center gap-1">
              <div className="text-3xl">{model.icon}</div>
              <h3 className="text-center font-semibold text-sm text-accent">
                {model.label}
              </h3>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-2">Campo X</div>
              <div className="font-medium text-sm truncate">{recommendation.x_field}</div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-2">Campo Y</div>
              <div className="font-medium text-sm truncate">{recommendation.y_field}</div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-2">Registros</div>
              <div className="font-medium text-sm">{executionResult.result.row_count}</div>
            </div>
          </div>

          {/* Alternativas do modelo ML */}
          {recommendation.alternatives && recommendation.alternatives.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Outras sugestões do modelo</h4>
              <div className="flex flex-wrap gap-2">
                {recommendation.alternatives.map((alt) => {
                  const altNorm = normalizeChartType(alt.chart_type);
                  const altModel = getChartModel(altNorm);
                  const isSelected = normalizeChartType(recommendation.chart_type) === altNorm;
                  return (
                    <button
                      key={alt.chart_type}
                      onClick={() => handleSelectAlternative(alt.chart_type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        isSelected
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-muted/40 border-border hover:bg-muted"
                      }`}
                    >
                      <span>{altModel.icon}</span>
                      <span className="font-medium">{altModel.label}</span>
                      <span className="text-muted-foreground ml-1">
                        {(alt.probability * 100).toFixed(0)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview do gráfico */}
          {previewData.length > 0 && (
            <div className="border rounded-lg p-3 bg-muted/20">
              <h4 className="text-sm font-semibold mb-3">Pré-visualização</h4>
              <ChartRenderer
                chartType={recommendation.chart_type}
                data={previewData}
                xField={recommendation.x_field}
                yField={recommendation.y_field}
                columns={columns}
                colors={DEFAULT_COLORS}
                title={recommendation.title}
              />
            </div>
          )}

          {/* Detalhes */}
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
          </div>

          {/* Dados processados */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Colunas Disponíveis</h4>
            <div className="flex flex-wrap gap-1">
              {columns.map((col) => (
                <Badge key={col} variant="outline" className="text-xs">
                  {col}
                </Badge>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="border-t pt-4 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={onReject} className="flex-1">
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
