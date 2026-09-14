import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { poolService } from "@/lib/services/poolService";
import { userErrorMessage } from "@/lib/user-error";

export function usePoolOrganizationActions(poolId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool", poolId] });
    void queryClient.invalidateQueries({ queryKey: ["pool", poolId, "participants"] });
    void queryClient.invalidateQueries({ queryKey: ["pool-games", poolId] });
    void queryClient.invalidateQueries({ queryKey: ["pool-events", poolId] });
    void queryClient.invalidateQueries({ queryKey: ["pools"] });
  };

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => poolService.setArchived(poolId, archived),
    onSuccess: (_data, archived) => {
      toast.success(archived ? "Bolão arquivado" : "Bolão restaurado");
      invalidate();
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });

  return { archiveMutation, invalidate };
}